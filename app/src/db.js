const { Client } = require('pg')

const client = new Client({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'tesla',
  password: process.env.DB_PASS || 'tesla',
  database: process.env.DB_NAME || 'tesla'
})

let inited = false

const init = async () => {
  if (inited) return
  await client.connect()
  await client.query(`
    CREATE TABLE IF NOT EXISTS used_cn_y (
      id SERIAL PRIMARY KEY,
      vin TEXT UNIQUE,
      model TEXT,
      price NUMERIC,
      mileage NUMERIC,
      url TEXT,
      first_seen TIMESTAMPTZ DEFAULT now(),
      last_seen TIMESTAMPTZ DEFAULT now()
    );
  `)
  inited = true
}

const upsertCars = async cars => {
  const text = `
    INSERT INTO used_cn_y (vin, model, price, mileage, url)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (vin)
    DO UPDATE SET price = EXCLUDED.price,
                  mileage = EXCLUDED.mileage,
                  url = EXCLUDED.url,
                  last_seen = now();
  `
  for (const c of cars) {
    const vin = c.vin
    if (!vin) continue
    await client.query(text, [vin, c.model, c.price, c.mileage, c.url])
  }
}

const getKnownVins = async () => {
  const res = await client.query('SELECT vin FROM used_cn_y;')
  return res.rows.map(r => r.vin)
}

module.exports = {
  init,
  upsertCars,
  getKnownVins
}
