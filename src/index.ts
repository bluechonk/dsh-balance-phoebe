import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'dsh-balance-phoebe'

export interface Config {
  /** API 基础地址 */
  apiBaseUrl: string
  /** 查询间隔（秒） */
  refreshInterval: number
}

export const Config: Schema<Config> = Schema.object({
  apiBaseUrl: Schema.string().default('http://127.0.0.1:3080'),
  refreshInterval: Schema.number().default(30).min(5).max(300),
})

export function apply(ctx: Context, config: Config) {
  ctx.tools.register(defineTool({
    name: 'phoebe_balance',
    description: '查询当前余额信息，返回菲比挂件的余额数据',
    parameters: {},
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute() {
      return `菲比余额挂件已就绪 (API: ${config.apiBaseUrl}, 刷新间隔: ${config.refreshInterval}s)`
    },
  }))
}
