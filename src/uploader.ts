import * as qiniu from 'qiniu'
import { type Inputs } from './inputs'
import { glob } from 'glob'
import { Semaphore } from 'semaphore-promise'
import * as fs from 'node:fs/promises'
import * as path from 'path'

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
  multipartUploadApiVersion: number
  config: qiniu.conf.Config
  mac: qiniu.auth.digest.Mac
}

export async function uploadGlobs (inputs: Inputs, config: qiniu.conf.Config): Promise<void> {
  const includeArtifacts = []; const excludeArtifacts = []

  for (const artifact of inputs.artifacts) {
    if (artifact.startsWith('!')) {
      excludeArtifacts.push(artifact.slice(1))
    } else {
      includeArtifacts.push(artifact)
    }
  }
  const localFiles = await glob(includeArtifacts, { ignore: excludeArtifacts, nodir: true })
  const semaphore = new Semaphore(inputs.concurrency)
  await Promise.all(localFiles.map(async localFile => {
    const release = await semaphore.acquire()
    try {
      let posixLocalFile = localFile
      if (path.delimiter !== path.posix.delimiter) {
        posixLocalFile = localFile.split(path.delimiter).join(path.posix.delimiter)
      }
      const remoteFile = inputs.prefix + posixLocalFile
      await doUploadTask({ localFile, remoteFile }, {
        bucket: inputs.bucket,
        mac: new qiniu.auth.digest.Mac(inputs.accessKey, inputs.secretKey),
        fileType: inputs.fileType,
        overwrite: inputs.overwrite,
        multipartUploadPartSize: inputs.multipartUploadPartSize,
        multipartUploadThreshold: inputs.multipartUploadThreshold,
        multipartUploadApiVersion: inputs.multipartUploadApiVersion,
        config
      })
    } finally {
      release()
    }
  }))
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
      version: properties.multipartUploadApiVersion === 1 ? 'v1' : 'v2'
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
