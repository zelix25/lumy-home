import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),

  // Database
  DATABASE_PATH: Joi.string().default('data/lumy.db'),

  // MQTT
  MQTT_BROKER_URL: Joi.string().uri().default('mqtt://localhost:1883'),
  MQTT_USERNAME: Joi.string().optional(),
  MQTT_PASSWORD: Joi.string().optional(),
  MQTT_CLIENT_ID: Joi.string().default('lumy'),
  MQTT_RECONNECT_PERIOD: Joi.number().default(5000),

  // AI (Gemma 3)
  LLAMA_API_URL: Joi.string().uri().default('http://localhost:11434'),
  LLAMA_MODEL: Joi.string().default('gemma3'),
  USE_LOCAL_LLAMA: Joi.boolean().default(true),

  // Auth
  JWT_SECRET: Joi.string().default('lumy-secret-key-change-in-production'),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  ENABLE_LOCAL_MODE: Joi.boolean().default(true), // Mode local sans compte

  // Store
  STORE_BASE_URL: Joi.string()
    .uri()
    .default('https://store.lumy-home.com'),
});

