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
  const multipartUploadApiVersion = parseInt(core.getInput(InputsFieldNames.MultipartUploadApiVersion))
  const bucketUrls = core.getMultilineInput(InputsFieldNames.BucketUrls)
  const upUrls = core.getMultilineInput(InputsFieldNames.UpUrls)
  const useInsecureProtocol = core.getBooleanInput(InputsFieldNames.UseInsecureProtocol)
  const artifacts = core.getMultilineInput(InputsFieldNames.Artifacts)

  let zone: qiniu.conf.Zone | undefined
  if (upUrls.length > 0) {
    zone = new qiniu.conf.Zone(upUrls)
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
  if (isNaN(multipartUploadThreshold) || (multipartUploadApiVersion !== 1 && multipartUploadApiVersion !== 2)) {
    core.setFailed(`Invalid multipart_upload_threshold: ${core.getInput(InputsFieldNames.MultipartUploadThreshold)}`)
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
    multipartUploadApiVersion,
    bucketUrls,
    zone,
    useInsecureProtocol,
    artifacts
  }
}
