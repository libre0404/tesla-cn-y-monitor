const fetch = require('node-fetch')
const { init, upsertCars, getKnownVins } = require('./db')
const WEBHOOK = process.env.WECOM_WEBHOOK_URL
const API_URL = process.env.TESLA_API_URL

const sleep = ms => new Promise(r => setTimeout(r, ms))

const sendWecom = async cars => {
  if (!WEBHOOK) {
    console.error('未设置 WECOM_WEBHOOK_URL')
    return
  }

  if (!cars.length) return

  const lines = cars.map(c => {
    return (
      `**车型**: ${c.model || 'Model Y'}  \n` +
      `**价格**: ${c.price || 'N/A'} 元  \n` +
      `**里程**: ${c.mileage || 'N/A'} km  \n` +
      `**VIN**: \`${c.vin || 'N/A'}\`  \n` +
      `**链接**: ${c.url || 'N/A'}  \n`
    )
  }).join('\n---\n')

  const body = {
    msgtype: 'markdown',
    markdown: {
      content: `### 🚗 中国区二手 Model Y 新增车辆\n\n${lines}`
    }
  }

  const res = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  console.log('WeCom 状态:', res.status)
}

const fetchInventory = async () => {
  if (!API_URL) {
    throw new Error('未设置 TESLA_API_URL')
  }
  const res = await fetch(API_URL)
  if (!res.ok) {
    throw new Error(`库存 API 请求失败: ${res.status}`)
  }
  const data = await res.json()
  // 按你的第三方返回结构调整，这里假设 data.cars 是数组
  const cars = data.cars || data.results || data || []
  return cars.map(c => ({
    vin: c.vin || c.VIN,
    model: c.model || c.Model || 'Model Y',
    price: c.price || c.Price,
    mileage: c.mileage || c.Odometer,
    url: c.url || c.ViewLink
  })).filter(c => c.vin)
}

const loop = async () => {
  await init()
  while (true) {
    try {
      console.log('开始拉取库存...')
      const cars = await fetchInventory()
      console.log('当前库存数量:', cars.length)

      const knownVins = new Set(await getKnownVins())
      const newCars = cars.filter(c => !knownVins.has(c.vin))

      if (newCars.length > 0) {
        console.log('发现新车数量:', newCars.length)
        await upsertCars(cars)
        await sendWecom(newCars.slice(0, 5))
      } else {
        console.log('没有新增车辆')
        await upsertCars(cars)
      }
    } catch (e) {
      console.error('运行错误:', e && e.message ? e.message : e)
    }

    await sleep(5 * 60 * 1000) // 每 5 分钟循环一次
  }
}

loop()
