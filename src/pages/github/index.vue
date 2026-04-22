<script setup lang="ts">
import { ElMessage } from 'element-plus'
import JSZip from 'jszip'
import { ref } from 'vue'

const url = ref('')
const pat = ref('')
const loading = ref(false)
const progress = ref(0)
const statusText = ref('')
const totalFiles = ref(0)
const downloadedFiles = ref(0)

type ResourceType = 'file' | 'dir'

interface ParsedUrl {
  type: ResourceType
  owner: string
  repo: string
  branch: string
  path: string
  unresolvedSegments: string[]
}

interface GitHubRepoInfo {
  default_branch: string
}

interface GitHubContentEntry {
  type: 'file' | 'dir' | 'submodule' | 'symlink'
  name: string
  path: string
}

interface GitHubTreeItem {
  path: string
  type: 'blob' | 'tree' | 'commit'
}

interface GitHubTreeResponse {
  tree: GitHubTreeItem[]
  truncated?: boolean
}

function encodeGitHubPath(path: string) {
  return path
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/')
}

function buildGitHubHeaders(accept = 'application/vnd.github+json') {
  const headers: Record<string, string> = { Accept: accept }
  if (pat.value.trim())
    headers.Authorization = `token ${pat.value.trim()}`
  return headers
}

async function githubRequest(endpoint: string, accept?: string) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: buildGitHubHeaders(accept),
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('访问 GitHub 失败，可能是 API 限流、仓库私有，或 PAT 无效。')
    }
    if (response.status === 404)
      throw new Error('未找到对应的 GitHub 资源，请检查链接是否正确。')
    throw new Error(`GitHub API 请求失败：${response.status} ${response.statusText}`)
  }

  return response
}

async function apiFetchJson<T>(endpoint: string) {
  const response = await githubRequest(endpoint)
  return response.json() as Promise<T>
}

function buildContentsEndpoint(owner: string, repo: string, path: string, ref: string) {
  const encodedPath = encodeGitHubPath(path)
  const basePath = encodedPath
    ? `/repos/${owner}/${repo}/contents/${encodedPath}`
    : `/repos/${owner}/${repo}/contents`
  return `${basePath}?ref=${encodeURIComponent(ref)}`
}

function parseGithubUrl(urlStr: string): ParsedUrl | null {
  try {
    const parsedUrl = new URL(urlStr)
    const parts = parsedUrl.pathname.split('/').filter(Boolean)

    if (parsedUrl.hostname === 'raw.githubusercontent.com') {
      const [owner, repo, ...rest] = parts
      if (!owner || !repo || rest.length < 2)
        return null

      return {
        type: 'file',
        owner,
        repo,
        branch: '',
        path: '',
        unresolvedSegments: rest,
      }
    }

    if (parsedUrl.hostname === 'github.com') {
      const [owner, repo, viewType, ...rest] = parts
      if (!owner || !repo)
        return null

      if (!viewType) {
        return {
          type: 'dir',
          owner,
          repo,
          branch: '',
          path: '',
          unresolvedSegments: [],
        }
      }

      if (viewType === 'blob' || viewType === 'tree') {
        return {
          type: viewType === 'blob' ? 'file' : 'dir',
          owner,
          repo,
          branch: '',
          path: '',
          unresolvedSegments: rest,
        }
      }
    }
  }
  catch {
    return null
  }

  return null
}

async function getDefaultBranch(owner: string, repo: string) {
  const repoInfo = await apiFetchJson<GitHubRepoInfo>(`/repos/${owner}/${repo}`)
  return repoInfo.default_branch
}

async function validateResourceAtRef(owner: string, repo: string, type: ResourceType, ref: string, path: string) {
  const endpoint = buildContentsEndpoint(owner, repo, path, ref)
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: buildGitHubHeaders(),
  })

  if (response.status === 404)
    return false

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('访问 GitHub 失败，可能是 API 限流、仓库私有，或 PAT 无效。')
    }
    throw new Error(`GitHub API 请求失败：${response.status} ${response.statusText}`)
  }

  const content = await response.json() as GitHubContentEntry | GitHubContentEntry[]
  if (Array.isArray(content))
    return type === 'dir'

  return content.type === type
}

async function resolveParsedUrl(parsed: ParsedUrl): Promise<ParsedUrl> {
  if (parsed.branch)
    return parsed

  if (parsed.unresolvedSegments.length === 0) {
    return {
      ...parsed,
      branch: await getDefaultBranch(parsed.owner, parsed.repo),
    }
  }

  for (let index = parsed.unresolvedSegments.length; index >= 1; index--) {
    const candidateBranch = parsed.unresolvedSegments.slice(0, index).join('/')
    const candidatePath = parsed.unresolvedSegments.slice(index).join('/')

    if (parsed.type === 'file' && !candidatePath)
      continue

    if (await validateResourceAtRef(parsed.owner, parsed.repo, parsed.type, candidateBranch, candidatePath)) {
      return {
        ...parsed,
        branch: candidateBranch,
        path: candidatePath,
      }
    }
  }

  throw new Error('无法识别 URL 中的分支与路径，请确认链接指向的是具体文件或目录。')
}

function downloadBlob(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(blobUrl)
}

async function fetchFileBlob(owner: string, repo: string, branch: string, path: string) {
  const endpoint = buildContentsEndpoint(owner, repo, path, branch)
  const response = await githubRequest(endpoint, 'application/vnd.github.raw')
  return response.blob()
}

async function downloadFile(parsed: ParsedUrl) {
  statusText.value = `正在下载文件：${parsed.path}`
  progress.value = 45

  const blob = await fetchFileBlob(parsed.owner, parsed.repo, parsed.branch, parsed.path)
  const filename = parsed.path.split('/').pop() || 'download'

  downloadBlob(blob, filename)
  progress.value = 100
  statusText.value = '下载完成'
}

async function downloadDir(parsed: ParsedUrl) {
  statusText.value = '正在获取目录结构...'
  progress.value = 15

  const treeData = await apiFetchJson<GitHubTreeResponse>(`/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(parsed.branch)}?recursive=1`)
  if (treeData.truncated) {
    throw new Error('目录过大，GitHub 返回结果被截断，请改为下载更小的子目录。')
  }

  const targetPrefix = parsed.path ? `${parsed.path.replace(/\/$/, '')}/` : ''
  const filesToDownload = treeData.tree.filter(item => item.type === 'blob' && item.path.startsWith(targetPrefix))

  if (filesToDownload.length === 0) {
    throw new Error('该目录下未找到可下载文件，请检查链接是否正确。')
  }

  totalFiles.value = filesToDownload.length
  downloadedFiles.value = 0
  statusText.value = `共找到 ${totalFiles.value} 个文件，开始下载...`

  const zip = new JSZip()
  const failedFiles: string[] = []
  const batchSize = 5

  for (let index = 0; index < filesToDownload.length; index += batchSize) {
    const batch = filesToDownload.slice(index, index + batchSize)

    await Promise.all(batch.map(async (item) => {
      try {
        const blob = await fetchFileBlob(parsed.owner, parsed.repo, parsed.branch, item.path)
        const relativePath = targetPrefix ? item.path.slice(targetPrefix.length) : item.path
        zip.file(relativePath, blob)
      }
      catch {
        failedFiles.push(item.path)
      }
      finally {
        downloadedFiles.value++
        progress.value = 15 + Math.floor((downloadedFiles.value / totalFiles.value) * 70)
        statusText.value = `已处理 ${downloadedFiles.value} / ${totalFiles.value}`
      }
    }))
  }

  if (downloadedFiles.value === failedFiles.length) {
    throw new Error('目录中的文件下载全部失败，请检查仓库权限或稍后重试。')
  }

  statusText.value = '正在打包 ZIP，请稍候...'
  progress.value = 92

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const filename = parsed.path.split('/').filter(Boolean).pop() || parsed.repo

  downloadBlob(zipBlob, `${filename}.zip`)
  progress.value = 100
  statusText.value = failedFiles.length > 0
    ? `下载完成，${failedFiles.length} 个文件打包失败`
    : '下载完成'

  if (failedFiles.length > 0) {
    ElMessage.warning(`有 ${failedFiles.length} 个文件下载失败，已跳过后打包其余文件。`)
  }
}

async function handleDownload() {
  const inputUrl = url.value.trim()
  if (!inputUrl) {
    ElMessage.warning('请输入 GitHub URL')
    return
  }

  const parsed = parseGithubUrl(inputUrl)
  if (!parsed) {
    ElMessage.error('无法解析该 URL，请输入有效的 GitHub 文件、目录或 Raw 链接。')
    return
  }

  loading.value = true
  progress.value = 0
  statusText.value = '正在解析链接...'
  totalFiles.value = 0
  downloadedFiles.value = 0

  try {
    const resolved = await resolveParsedUrl(parsed)
    if (resolved.type === 'file')
      await downloadFile(resolved)
    else
      await downloadDir(resolved)

    ElMessage.success('下载成功')
  }
  catch (error: unknown) {
    statusText.value = '下载失败'
    ElMessage.error(error instanceof Error ? error.message : '下载过程中出现未知错误')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="m-auto max-w-1200px min-h-screen p-4 lg:p-8 sm:p-6">
    <el-card shadow="hover" class="mb-6 rounded-xl">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="text-gray-700 font-bold dark:text-gray-200">GitHub 文件/目录下载</span>
          <el-tag size="small" type="info" effect="plain">
            支持单文件或整个目录
          </el-tag>
        </div>
      </template>

      <div class="flex flex-col gap-4">
        <div>
          <label class="mb-2 block text-sm text-gray-600 font-medium dark:text-gray-300">GitHub URL</label>
          <el-input
            v-model="url"
            placeholder="例如：https://github.com/vuejs/core/tree/main/packages/compiler-core"
            clearable
          >
            <template #prefix>
              <Icon icon="mdi:github" class="text-gray-400" />
            </template>
          </el-input>
          <p class="mt-2 text-xs text-gray-500">
            支持 blob (单文件)、tree (目录) 或直接输入仓库根目录。也支持 raw.githubusercontent.com 链接。
          </p>
        </div>

        <div>
          <label class="mb-2 block text-sm text-gray-600 font-medium dark:text-gray-300">Personal Access Token (可选)</label>
          <el-input
            v-model="pat"
            placeholder="如果遇到 API 限流，请在此输入 PAT (仅在本地内存使用，不保存)"
            type="password"
            show-password
            clearable
          >
            <template #prefix>
              <Icon icon="mdi:key" class="text-gray-400" />
            </template>
          </el-input>
        </div>

        <div class="mt-2 flex justify-end">
          <el-button type="primary" size="large" :loading="loading" @click="handleDownload">
            <template #icon>
              <Icon icon="mdi:download" />
            </template>
            开始下载
          </el-button>
        </div>
      </div>
    </el-card>

    <el-card v-if="loading || progress > 0" shadow="hover" class="rounded-xl">
      <template #header>
        <div class="flex items-center">
          <span class="text-gray-700 font-bold dark:text-gray-200">下载状态</span>
        </div>
      </template>
      <div class="flex flex-col gap-4">
        <el-progress
          :percentage="progress"
          :status="progress === 100 ? 'success' : ''"
          :stroke-width="15"
          striped
          striped-flow
        />
        <div class="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>{{ statusText }}</span>
          <span v-if="totalFiles > 0">{{ downloadedFiles }} / {{ totalFiles }}</span>
        </div>
      </div>
    </el-card>
  </div>
</template>
