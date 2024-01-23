import * as qiniu from 'qiniu'
import { getInputs } from './input-helpers'
import { uploadGlobs } from './uploader'

async function run (): Promise<void> {
  const inputs = getInputs()
  qiniu.conf.USER_AGENT += ' QiniuUploadAction/v0.1.0'
  if (inputs.bucketUrls.length > 0) {
    (qiniu.conf as any).QUERY_REGION_HOST = inputs.bucketUrls[0]
    if (inputs.bucketUrls.length > 1) {
      (qiniu.conf as any).QUERY_REGION_BACKUP_HOSTS = inputs.bucketUrls.slice(1)
    }
  }

  const configOptions: qiniu.conf.ConfigOptions = { useHttpsDomain: !inputs.useInsecureProtocol }
  if (inputs.zone !== null) {
    configOptions.zone = inputs.zone
  }
  const config = new qiniu.conf.Config(configOptions)
  await uploadGlobs(inputs, config)
}

void run()
