# Model matrix

Pass or fail per check, from bench/mapcheck.mjs. This is not a ranking: rows keep the order of --models.

| model | repo | front matter | sections | paths | directives | sentences | em dashes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| deepseek/deepseek-v4-pro | ky | fail | pass | fail | pass | pass | fail |
| deepseek/deepseek-v4-pro | itsdangerous | pass | pass | pass | pass | pass | fail |
| deepseek/deepseek-v4-pro | pflag | pass | pass | fail | pass | fail | fail |
| deepseek/deepseek-v4.1-flash | ky | pass | pass | pass | pass | fail | fail |
| deepseek/deepseek-v4.1-flash | itsdangerous | pass | pass | pass | pass | pass | fail |
| deepseek/deepseek-v4.1-flash | pflag | pass | pass | pass | pass | pass | fail |
| moonshotai/kimi-k2.6 | ky | fail | fail | fail | fail | fail | pass |
| moonshotai/kimi-k2.6 | itsdangerous | error |  |  |  |  |  |
| moonshotai/kimi-k2.6 | pflag | fail | fail | pass | fail | pass | pass |
| qwen/qwen3.8-27b | ky | error |  |  |  |  |  |
| qwen/qwen3.8-27b | itsdangerous | error |  |  |  |  |  |
| qwen/qwen3.8-27b | pflag | error |  |  |  |  |  |
| qwen/qwen3-coder-next | ky | fail | pass | pass | pass | pass | fail |
| qwen/qwen3-coder-next | itsdangerous | pass | pass | pass | pass | pass | fail |
| qwen/qwen3-coder-next | pflag | pass | pass | pass | pass | fail | fail |
| z-ai/glm-5.1 | ky | error |  |  |  |  |  |
| z-ai/glm-5.1 | itsdangerous | fail | pass | pass | pass | pass | fail |
| z-ai/glm-5.1 | pflag | pass | pass | pass | pass | fail | fail |
| minimax/minimax-m2.7 | ky | fail | pass | pass | fail | fail | pass |
| minimax/minimax-m2.7 | itsdangerous | pass | pass | pass | fail | fail | pass |
| minimax/minimax-m2.7 | pflag | fail | pass | pass | pass | pass | fail |
| nousresearch/hermes-4-405b | ky | fail | pass | pass | fail | fail | pass |
| nousresearch/hermes-4-405b | itsdangerous | pass | pass | pass | pass | pass | pass |
| nousresearch/hermes-4-405b | pflag | fail | pass | pass | fail | pass | pass |
| mistralai/devstral-2512 | ky | fail | pass | fail | fail | pass | pass |
| mistralai/devstral-2512 | itsdangerous | pass | pass | pass | fail | pass | pass |
| mistralai/devstral-2512 | pflag | pass | pass | pass | fail | fail | pass |
| meta-llama/llama-4-maverick | ky | fail | pass | fail | pass | pass | pass |
| meta-llama/llama-4-maverick | itsdangerous | fail | pass | fail | pass | pass | pass |
| meta-llama/llama-4-maverick | pflag | pass | pass | pass | pass | fail | pass |
| google/gemma-4-31b-it | ky | fail | pass | fail | pass | pass | pass |
| google/gemma-4-31b-it | itsdangerous | pass | pass | pass | pass | pass | pass |
| google/gemma-4-31b-it | pflag | pass | pass | pass | pass | pass | pass |
| openai/gpt-oss-120b | ky | fail | pass | fail | fail | fail | pass |
| openai/gpt-oss-120b | itsdangerous | fail | pass | pass | fail | pass | pass |
| openai/gpt-oss-120b | pflag | fail | pass | pass | fail | pass | pass |
| google/gemini-3.8-flash | ky | pass | pass | pass | pass | pass | pass |
| google/gemini-3.8-flash | itsdangerous | pass | pass | pass | pass | pass | pass |
| google/gemini-3.8-flash | pflag | fail | pass | pass | pass | pass | pass |
| openai/gpt-6.1-sol | ky | pass | pass | pass | fail | pass | fail |
| openai/gpt-6.1-sol | itsdangerous | pass | pass | fail | fail | pass | fail |
| openai/gpt-6.1-sol | pflag | pass | pass | pass | pass | pass | pass |
| x-ai/grok-4.7 | ky | pass | pass | pass | fail | pass | fail |
| x-ai/grok-4.7 | itsdangerous | pass | pass | pass | pass | pass | pass |
| x-ai/grok-4.7 | pflag | pass | pass | pass | pass | pass | fail |

Errors:

- moonshotai/kimi-k2.6 on itsdangerous: HTTP 200: no choices[0].message.content
- qwen/qwen3.8-27b on ky: HTTP 200: no choices[0].message.content
- qwen/qwen3.8-27b on itsdangerous: HTTP 200: no choices[0].message.content
- qwen/qwen3.8-27b on pflag: HTTP 200: no choices[0].message.content
- z-ai/glm-5.1 on ky: HTTP 200: no choices[0].message.content
