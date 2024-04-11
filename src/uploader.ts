import * as qiniu from 'qiniu'
import { type Inputs } from './inputs'
import { glob } from 'glob'
import { Semaphore } from 'semaphore-promise'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

interface UploadTask {
  localFile: string
  remoteFile: string
}

interface UploadProperties {
  bucket: string
  fileType: number
  overwrite: boolean
  multipartUploadPartSize: number
  multipartUploadThreshold: number
  config: qiniu.conf.Config
  mac: qiniu.auth.digest.Mac
}

export async function uploadGlobs (inputs: Inputs, config: qiniu.conf.Config): Promise<void> {
  const includeArtifacts: string[] = []
  const excludeArtifacts: string[] = []

  for (const artifact of inputs.artifacts) {
    if (artifact.startsWith('!')) {
      excludeArtifacts.push(artifact.slice(1))
    } else {
      includeArtifacts.push(artifact)
    }
  }
  const localFiles = await glob(includeArtifacts, { ignore: excludeArtifacts, nodir: true })
  const semaphore = new Semaphore(inputs.concurrency)
  const restPromises = new Set()
  let error: Error | undefined
  for (const localFile of localFiles) {
    const release = await semaphore.acquire()
    let posixLocalFile = localFile
    if (path.sep !== path.posix.sep) {
      posixLocalFile = localFile.split(path.sep).join(path.posix.sep)
    }
    const remoteFile = inputs.prefix + posixLocalFile
    const p = doUploadTask({ localFile, remoteFile }, {
      bucket: inputs.bucket,
      mac: new qiniu.auth.digest.Mac(inputs.accessKey, inputs.secretKey),
      fileType: inputs.fileType,
      overwrite: inputs.overwrite,
      multipartUploadPartSize: inputs.multipartUploadPartSize,
      multipartUploadThreshold: inputs.multipartUploadThreshold,
      config
    })
    restPromises.add(p)
    p
      .then(() => {
        restPromises.delete(p)
      })
      .catch(err => {
        if (error == null) {
          error = err
        }
      })
      .finally(release)
  }
  if (error != null) {
    throw error
  }
  await Promise.all(restPromises)
}

async function doUploadTask (task: UploadTask, properties: UploadProperties): Promise<void> {
  const fsInfo = await fs.stat(task.localFile)
  if (fsInfo.size < properties.multipartUploadThreshold) {
    await doUploadByForm(task, properties)
  } else {
    await doUploadByMultiparts(task, properties)
  }
}

async function doUploadByForm (task: UploadTask, properties: UploadProperties): Promise<void> {
  const formUploader = new qiniu.form_up.FormUploader(properties.config)
  await formUploader.putFile(
    makeUploadToken(properties),
    task.remoteFile,
    task.localFile,
    {
      fname: path.basename(task.localFile),
      params: {},
      checkCrc: true
    },
    () => {}
  )
}

async function doUploadByMultiparts (task: UploadTask, properties: UploadProperties): Promise<void> {
  const resumeUploader = new qiniu.resume_up.ResumeUploader(properties.config)
  await resumeUploader.putFile(
    makeUploadToken(properties),
    task.remoteFile,
    task.localFile,
    {
      fname: path.basename(task.localFile),
      params: {},
      partSize: properties.multipartUploadPartSize,
      version: 'v2'
    },
    () => {}
  )
}

function makeUploadToken (properties: UploadProperties): string {
  const options: qiniu.rs.PutPolicyOptions = { scope: properties.bucket, expires: 3600, fileType: properties.fileType }
  if (!properties.overwrite) {
    options.insertOnly = 1
  }
  const policy = new qiniu.rs.PutPolicy(options)
  return policy.uploadToken(properties.mac)
}
