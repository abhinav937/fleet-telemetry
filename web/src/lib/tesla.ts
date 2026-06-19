const TESLA_BASE = "https://fleet-api.prd.na.vn.cloud.tesla.com/api/1";
const TESLA_AUTH = "https://auth.tesla.com/oauth2/v3";

export const TESLA_OAUTH_URL = `${TESLA_AUTH}/authorize`;
export const TESLA_TOKEN_URL = `${TESLA_AUTH}/token`;

export function getTeslaAuthUrl(state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.TESLA_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/tesla/callback`,
    scope: "openid offline_access vehicle_device_data vehicle_cmds vehicle_charging_cmds",
    state,
  });
  return `${TESLA_OAUTH_URL}?${params}`;
}

export async function exchangeCode(code: string) {
  const res = await fetch(TESLA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.TESLA_CLIENT_ID!,
      client_secret: process.env.TESLA_CLIENT_SECRET!,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/tesla/callback`,
    }),
  });
  if (!res.ok) throw new Error(`Tesla token exchange failed: ${res.statusText}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(TESLA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.TESLA_CLIENT_ID!,
      client_secret: process.env.TESLA_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Tesla token refresh failed: ${res.statusText}`);
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

async function teslaFetch(accessToken: string, path: string, options: RequestInit = {}) {
  const res = await fetch(`${TESLA_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Tesla API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function registerPartner() {
  // Get a partner token via client_credentials
  const tokenRes = await fetch(TESLA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.TESLA_CLIENT_ID!,
      client_secret: process.env.TESLA_CLIENT_SECRET!,
      scope: "openid vehicle_device_data vehicle_cmds vehicle_charging_cmds offline_access",
      audience: "https://fleet-api.prd.na.vn.cloud.tesla.com",
    }),
  });
  if (!tokenRes.ok) throw new Error(`Partner token failed: ${await tokenRes.text()}`);
  const { access_token } = await tokenRes.json();

  const domain = new URL(process.env.NEXT_PUBLIC_APP_URL!).hostname;
  const regRes = await fetch(`${TESLA_BASE}/partner_accounts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ domain }),
  });
  if (!regRes.ok) throw new Error(`Partner registration failed: ${await regRes.text()}`);
  return regRes.json();
}

export async function getVehicles(accessToken: string) {
  const data = await teslaFetch(accessToken, "/vehicles");
  return data.response as TeslaVehicle[];
}

export async function getVehicleData(accessToken: string, vehicleId: string) {
  const data = await teslaFetch(accessToken, `/vehicles/${vehicleId}/vehicle_data`);
  return data.response as TeslaVehicleData;
}

export async function sendCommand(accessToken: string, vehicleId: string, command: string, body?: object) {
  return teslaFetch(accessToken, `/vehicles/${vehicleId}/command/${command}`, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export interface TeslaVehicle {
  id: number;
  vehicle_id: number;
  vin: string;
  display_name: string;
  state: string;
  color?: string;
}

export interface TeslaVehicleData {
  id: number;
  display_name: string;
  vin: string;
  state: string;
  charge_state: {
    battery_level: number;
    charging_state: string;
    charge_limit_soc: number;
    minutes_to_full_charge: number;
    charge_rate: number;
  };
  climate_state: {
    inside_temp: number;
    outside_temp: number;
    is_climate_on: boolean;
    driver_temp_setting: number;
  };
  drive_state: {
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number;
  };
  vehicle_state: {
    locked: boolean;
    sentry_mode: boolean;
    is_user_present: boolean;
    odometer: number;
  };
}
