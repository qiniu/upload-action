import type * as qiniu from 'qiniu'

export enum InputsFieldNames {
  Bucket = 'bucket',
  AccessKey = 'access_key',
  SecretKey = 'secret_key',
  Prefix = 'prefix',
  FileType = 'file_type',
  Overwrite = 'overwrite',
  Concurrency = 'concurrency',
  MultipartUploadPartSize = 'multipart_upload_part_size',
  MultipartUploadThreshold = 'multipart_upload_threshold',
  BucketHosts = 'bucket_hosts',
  UploadHosts = 'upload_hosts',
  UseInsecureProtocol = 'use_insecure_protocol',
  Artifacts = 'artifacts',
}

export interface Inputs {
  // Qiniu bucket name
  bucket: string

  // Qiniu access key
  accessKey: string

  // Qiniu secret key
  secretKey: string

  // Remote path prefix
  prefix: string

  // Qiniu file type
  fileType: number

  /*
     * If true, an artifact will overwrite artifacts with the same name.
     * If false, the action will fail if an artifact for the given name already exists.
     * Does not fail if the artifact does not exist.
     */
  overwrite: boolean

  // Number of concurrent uploads
  concurrency: number

  // Size of each part of a multipart upload
  multipartUploadPartSize: number

  // Minimum size of a file before it is uploaded via multipart upload
  multipartUploadThreshold: number

  // Bucket service Hosts
  bucketHosts: string[]

  // Qiniu regions
  region?: qiniu.httpc.RegionsProvider

  // Use HTTP protocol
  useInsecureProtocol: boolean

  // Files glob to archive
  artifacts: string[]
}
