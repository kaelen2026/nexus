'use client'

import {
  CheckIcon,
  ChevronDownIcon,
  ClipboardIcon,
  LoaderCircleIcon,
  SparklesIcon,
} from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ApiError, apiClient, type GenerateResult, type NexusApi } from '@/lib/api-client'

const maxPromptLength = 100_000
const defaultNavigate = (path: string) => window.location.assign(path)

interface GenerateWorkspaceProps {
  api?: NexusApi
  navigate?: (path: string) => void
}

export function GenerateWorkspace({
  api = apiClient,
  navigate = defaultNavigate,
}: GenerateWorkspaceProps) {
  const [prompt, setPrompt] = useState('')
  const [maxTokens, setMaxTokens] = useState(1_000)
  const [result, setResult] = useState<GenerateResult>()
  const [error, setError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedPrompt = prompt.trim()
    if (!normalizedPrompt) {
      setError('请输入你想生成的内容')
      return
    }

    setError(undefined)
    setIsCopied(false)
    setIsSubmitting(true)
    try {
      const nextResult = await api.generate({
        model: 'standard',
        prompt: normalizedPrompt,
        maxTokens,
      })
      setResult(nextResult)
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'UNAUTHENTICATED') {
        navigate('/login')
        return
      }
      setResult(undefined)
      setError(cause instanceof Error ? cause.message : '生成失败，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function copyResult() {
    if (!result) return
    await navigator.clipboard.writeText(result.text)
    setIsCopied(true)
  }

  return (
    <div className="mx-auto w-full max-w-[96rem] px-6 py-12 sm:px-10 lg:py-16">
      <div className="grid items-start gap-14 lg:grid-cols-[minmax(22rem,0.82fr)_minmax(30rem,1.18fr)] lg:gap-10">
        <section aria-labelledby="generate-heading">
          <h1
            id="generate-heading"
            className="text-[2.15rem] font-semibold tracking-[-0.045em] sm:text-[2.65rem]"
          >
            和 Nexus 一起创作
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground sm:text-lg">
            描述你的想法，获得清晰、可用的回答。
          </p>

          <form className="mt-10" onSubmit={generate} noValidate>
            <label className="text-base font-semibold" htmlFor="generation-prompt">
              你想让 Nexus 做什么？
            </label>
            <div className="relative mt-3">
              <textarea
                id="generation-prompt"
                value={prompt}
                maxLength={maxPromptLength}
                onChange={(event) => {
                  setPrompt(event.target.value)
                  setError(undefined)
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'generation-error' : 'prompt-count'}
                placeholder="帮我整理一份新产品发布检查清单"
                className="min-h-[16.25rem] w-full resize-y rounded-xl border bg-background px-4 py-4 pb-10 text-base leading-7 outline-none transition-shadow placeholder:text-muted-foreground/65 focus:border-primary focus:ring-3 focus:ring-primary/15 aria-invalid:border-destructive sm:text-lg"
              />
              <span
                id="prompt-count"
                className="pointer-events-none absolute bottom-4 right-4 text-sm tabular-nums text-muted-foreground"
              >
                {prompt.length.toLocaleString()} / {maxPromptLength.toLocaleString()}
              </span>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="block text-base font-semibold">
                模型
                <span className="relative mt-3 block">
                  <select
                    aria-label="模型"
                    className="h-14 w-full appearance-none rounded-xl border bg-background px-4 pr-10 text-base outline-none focus:border-primary focus:ring-3 focus:ring-primary/15 lg:h-16 lg:text-lg"
                    defaultValue="standard"
                  >
                    <option value="standard">标准模型</option>
                  </select>
                  <ChevronDownIcon
                    className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                </span>
              </label>
              <label className="block text-base font-semibold">
                最大输出
                <span className="relative mt-3 block">
                  <select
                    aria-label="最大输出"
                    value={maxTokens}
                    onChange={(event) => setMaxTokens(Number(event.target.value))}
                    className="h-14 w-full appearance-none rounded-xl border bg-background px-4 pr-10 text-base outline-none focus:border-primary focus:ring-3 focus:ring-primary/15 lg:h-16 lg:text-lg"
                  >
                    <option value={500}>500 tokens</option>
                    <option value={1_000}>1,000 tokens</option>
                    <option value={2_000}>2,000 tokens</option>
                  </select>
                  <ChevronDownIcon
                    className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                </span>
              </label>
            </div>

            <Button
              type="submit"
              className="mt-7 h-14 w-full rounded-xl text-base lg:h-[4.625rem] lg:text-lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              ) : (
                <SparklesIcon aria-hidden="true" />
              )}
              {isSubmitting ? '正在生成' : '生成内容'}
            </Button>

            {error ? (
              <p
                id="generation-error"
                role="alert"
                className="mt-5 rounded-xl border border-destructive/25 bg-background px-4 py-3 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
          </form>
        </section>

        <section aria-live="polite" className="lg:pt-4">
          {isSubmitting ? (
            <div className="flex min-h-80 items-center justify-center border-y bg-background/70 px-6 lg:min-h-[39rem]">
              <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
                <LoaderCircleIcon className="size-5 animate-spin text-primary" aria-hidden="true" />
                Nexus 正在生成回答
              </div>
            </div>
          ) : result ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-semibold tracking-tight">生成结果</h2>
                <div className="flex items-center gap-5 text-sm text-muted-foreground">
                  <span>标准模型 · {result.usage.totalTokens.toLocaleString()} tokens</span>
                  <button
                    type="button"
                    onClick={copyResult}
                    className="flex items-center gap-2 font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-primary/20"
                  >
                    {isCopied ? (
                      <CheckIcon aria-hidden="true" />
                    ) : (
                      <ClipboardIcon aria-hidden="true" />
                    )}
                    {isCopied ? '已复制' : '复制'}
                  </button>
                </div>
              </div>
              <div className="mt-7 min-h-80 whitespace-pre-wrap rounded-xl border bg-background px-5 py-6 text-[0.98rem] leading-8 sm:px-6 lg:min-h-[39rem] lg:text-lg lg:leading-9">
                {result.text}
              </div>
            </div>
          ) : (
            <div className="flex min-h-80 items-center justify-center border-y border-dashed px-6 text-center text-sm leading-6 text-muted-foreground lg:min-h-[39rem]">
              生成的内容会显示在这里
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
