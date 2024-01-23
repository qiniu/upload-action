import { jest } from '@jest/globals'
import * as fs from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { Readable as ReadableStream } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { randomBytes } from 'node:crypto'
import { uploadGlobs } from '../src/uploader'
import * as qiniu from 'qiniu'

jest.mock('@actions/core')

test('upload files', async () => {
  const randomToFile = async function (filePath: string, size: number = Number.POSITIVE_INFINITY): Promise<void> {
    let producedSize = 0
    await pipeline(new ReadableStream({
      read (readSize) {
        let shouldEnd = false

        if ((producedSize + readSize) >= size) {
          readSize = size - producedSize
          shouldEnd = true
        }

        randomBytes(readSize, (error, buffer) => {
          if (error !== null && error !== undefined) {
            this.emit('error', error)
            return
          }
          producedSize += readSize
          this.push(buffer)
          if (shouldEnd) {
            this.push(null)
          }
        })
      }
    }), fs.createWriteStream(filePath))
  }

  const listQiniuPrefix = async function (mac: qiniu.auth.digest.Mac, bucket: string, prefix: string): Promise<string[]> {
    const bucketManager = new qiniu.rs.BucketManager(mac)
    type listCallback = (e?: Error, keys?: string[]) => void
    const listNextPage = function (marker: string, callback: listCallback): void {
      bucketManager.listPrefix(bucket, { prefix, marker, limit: 1000 }, (error, body, respInfo) => {
        if (error !== null && error !== undefined) {
          callback(error)
          return
        }
        if (respInfo.statusCode !== 200) {
          callback(new Error(`unexpected status code: ${respInfo.statusCode}`))
          return
        }
        callback(undefined, body.items.map((item: any) => item.key) as string[])
        if (body.marker !== undefined) {
          listNextPage(body.marker as string, callback)
        } else {
          callback(undefined, undefined)
        }
      })
    }
    let allKeys: string[] = []
    return await new Promise((resolve, reject) => {
      listNextPage('', (error, keys) => {
        if (error !== null && error !== undefined) {
          reject(error)
        } else if (keys !== undefined) {
          allKeys = allKeys.concat(...keys)
        } else {
          resolve(allKeys)
        }
      })
    })
  }

  const cleanQiniuPrefix = async function (mac: qiniu.auth.digest.Mac, bucket: string, allKeys: string[]): Promise<void> {
    const bucketManager = new qiniu.rs.BucketManager(mac)
    const deleteAllKeys = async function (keys: string[]): Promise<unknown> {
      return await new Promise((resolve, reject) => {
        const deleteOperations = keys.map(key => qiniu.rs.deleteOp(bucket, key))
        bucketManager.batch(deleteOperations, (error, _, respInfo) => {
          if (error !== null && error !== undefined) {
            reject(error)
          } else if (respInfo.statusCode !== 200) {
            reject(new Error(`unexpected status code: ${respInfo.statusCode}`))
          } else {
            resolve(undefined)
          }
        })
      })
    }
    while (allKeys.length >= 1000) {
      console.log('all keys length: ' + allKeys.length)
      const keys = allKeys.slice(0, 1000)
      allKeys = allKeys.slice(1000)
      await deleteAllKeys(keys)
    }
    if (allKeys.length > 0) {
      await deleteAllKeys(allKeys)
    }
  }

  const cwd = process.cwd()
  const tmpDirPath = path.join(os.tmpdir(), 'test')
  const bucket = process.env['QINIU_BUCKET'] ?? ''
  const accessKey = process.env['QINIU_ACCESS_KEY'] ?? ''
  const secretKey = process.env['QINIU_SECRET_KEY'] ?? ''
  const prefix = process.env['QINIU_BUCKET_PREFIX'] ?? ''
  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey)

  try {
    await fsPromises.mkdir(tmpDirPath, { recursive: true })
    process.chdir(tmpDirPath)
    await randomToFile(path.join(tmpDirPath, '1M'), 1024 * 1024)
    await randomToFile(path.join(tmpDirPath, '2M'), 2 * 1024 * 1024)
    await randomToFile(path.join(tmpDirPath, '5M'), 5 * 1024 * 1024)
    await randomToFile(path.join(tmpDirPath, '10M'), 10 * 1024 * 1024)
    await fsPromises.mkdir(path.join(tmpDirPath, 'subdir'), { recursive: true })
    await randomToFile(path.join(tmpDirPath, 'subdir', '1M'), 1024 * 1024)
    await randomToFile(path.join(tmpDirPath, 'subdir', '2M'), 2 * 1024 * 1024)
    await randomToFile(path.join(tmpDirPath, 'subdir', '5M'), 5 * 1024 * 1024)
    await randomToFile(path.join(tmpDirPath, 'subdir', '10M'), 10 * 1024 * 1024)

    await uploadGlobs({
      bucket,
      accessKey,
      secretKey,
      prefix,
      fileType: 0,
      overwrite: true,
      concurrency: 10,
      multipartUploadPartSize: 4 * 1024 * 1024,
      multipartUploadThreshold: 4 * 1024 * 1024,
      multipartUploadApiVersion: 2,
      bucketUrls: [],
      useInsecureProtocol: false,
      artifacts: ['**/*']
    }, new qiniu.conf.Config())
    const allKeys = await listQiniuPrefix(mac, bucket, prefix)
    expect(allKeys).toContain(path.posix.join(prefix, '1M'))
    expect(allKeys).toContain(path.posix.join(prefix, '2M'))
    expect(allKeys).toContain(path.posix.join(prefix, '5M'))
    expect(allKeys).toContain(path.posix.join(prefix, '10M'))
    expect(allKeys).toContain(path.posix.join(prefix, 'subdir', '1M'))
    expect(allKeys).toContain(path.posix.join(prefix, 'subdir', '2M'))
    expect(allKeys).toContain(path.posix.join(prefix, 'subdir', '5M'))
    expect(allKeys).toContain(path.posix.join(prefix, 'subdir', '10M'))
    await cleanQiniuPrefix(mac, bucket, allKeys)
  } catch {
    await cleanQiniuPrefix(mac, bucket, await listQiniuPrefix(mac, bucket, prefix))
  } finally {
    process.chdir(cwd)
    await fsPromises.rm(tmpDirPath, { recursive: true })
  }
})
