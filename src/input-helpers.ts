import * as core from '@actions/core'
import * as qiniu from 'qiniu'
import { type Inputs, InputsFieldNames } from './inputs'

export function getInputs (): Inputs {
  const bucket = core.getInput(InputsFieldNames.Bucket, { required: true })
  const accessKey = core.getInput(InputsFieldNames.AccessKey, { required: true })
  const secretKey = core.getInput(InputsFieldNames.SecretKey, { required: true })
  const prefix = core.getInput(InputsFieldNames.Prefix)
  const fileType = parseInt(core.getInput(InputsFieldNames.FileType))
  const overwrite = core.getBooleanInput(InputsFieldNames.Overwrite)
  const concurrency = parseInt(core.getInput(InputsFieldNames.Concurrency))
  const multipartUploadPartSize = parseInt(core.getInput(InputsFieldNames.MultipartUploadPartSize))
  const multipartUploadThreshold = parseInt(core.getInput(InputsFieldNames.MultipartUploadThreshold))
  const bucketHosts = core.getMultilineInput(InputsFieldNames.BucketHosts)
  const uploadHosts = core.getMultilineInput(InputsFieldNames.UploadHosts)
  const useInsecureProtocol = core.getBooleanInput(InputsFieldNames.UseInsecureProtocol)
  const artifacts = core.getMultilineInput(InputsFieldNames.Artifacts)

  for (const host of bucketHosts) {
    if (host.includes('://')) {
      core.setFailed(`Invalid bucket host: ${host}`)
    }
  }
  for (const host of uploadHosts) {
    if (host.includes('://')) {
      core.setFailed(`Invalid upload host: ${host}`)
    }
  }

  let region: qiniu.httpc.RegionsProvider | undefined
  if (uploadHosts.length > 0) {
    region = new qiniu.httpc.StaticRegionsProvider([
      new qiniu.httpc.Region({
        services: {
          up: uploadHosts.map(host => new qiniu.httpc.Endpoint(host, { defaultScheme: useInsecureProtocol ? 'http' : 'https' }))
        }
      })
    ])
  }

  if (isNaN(fileType)) {
    core.setFailed(`Invalid file_type: ${core.getInput(InputsFieldNames.FileType)}`)
  }
  if (isNaN(concurrency)) {
    core.setFailed(`Invalid concurrency: ${core.getInput(InputsFieldNames.Concurrency)}`)
  }
  if (isNaN(multipartUploadPartSize)) {
    core.setFailed(`Invalid multipart_upload_part_size: ${core.getInput(InputsFieldNames.MultipartUploadPartSize)}`)
  }

  return {
    bucket,
    accessKey,
    secretKey,
    prefix,
    fileType,
    overwrite,
    concurrency,
    multipartUploadPartSize,
    multipartUploadThreshold,
    bucketHosts,
    region,
    useInsecureProtocol,
    artifacts
  }
}
