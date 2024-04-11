import * as qiniu from 'qiniu'
import { getInputs } from './input-helpers'
import { uploadGlobs } from './uploader'
import pkg from '../package.json'

async function run (): Promise<void> {
  const inputs = getInputs()
  qiniu.conf.USER_AGENT = `QiniuUploadAction/v${pkg.version} ${qiniu.conf.USER_AGENT}`
  if (inputs.bucketHosts.length > 0) {
    (qiniu.conf as any).QUERY_REGION_HOST = inputs.bucketHosts[0]
    if (inputs.bucketHosts.length > 1) {
      (qiniu.conf as any).QUERY_REGION_BACKUP_HOSTS = inputs.bucketHosts.slice(1)
    }
  }

  const config = new qiniu.conf.Config({
    useHttpsDomain: !inputs.useInsecureProtocol,
    regionsProvider: inputs.region
  })
  await uploadGlobs(inputs, config)
}

void run()
