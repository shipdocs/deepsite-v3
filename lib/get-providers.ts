export const getProviders = async (model: string) => {
  const response = await fetch(`https://router.huggingface.co/v1/models/${model}`)
  const { data } = await response.json()
  return data.providers.map((provider: any) => provider.provider)
}