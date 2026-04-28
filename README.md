# Kong Gateway Dashboard

Admin dashboard สำหรับจัดการ Kong Gateway — สร้างด้วย Vue 3 + Vite + TypeScript

## สารบัญ

- [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์)
- [การติดตั้งและรัน](#การติดตั้งและรัน)
- [การใช้งาน Dashboard](#การใช้งาน-dashboard)
- [Token Auth & Authorization (UI)](#token-auth--authorization-ui)
- [Verify Token ด้วย Keycloak (curl)](#verify-token-ด้วย-keycloak-curl)
- [Authorization ตาม Role/Scope](#authorization-ตาม-rolescope)

---

## โครงสร้างโปรเจกต์

```
kong-gateway/
├── docker-compose.yml       # Kong 3.6 + Postgres 15 + nginx dashboard
├── nginx.conf               # Nginx: serve dashboard + proxy /api/ → kong:8001
├── dashboard/               # Vite build output (served by nginx)
├── src/
│   ├── main.ts              # Vue app entry + router + auth guard
│   ├── App.vue              # Layout: dark sidebar (Konga style)
│   ├── auth.ts              # Auth state + localStorage persistence
│   ├── api/kong.ts          # Kong Admin API client (fetch wrapper)
│   ├── types/kong.ts        # TypeScript interfaces
│   ├── composables/
│   │   └── useToast.ts
│   └── views/
│       ├── LoginView.vue    # หน้า login + กำหนด API URL
│       ├── DashboardView.vue
│       ├── ServicesView.vue
│       ├── RoutesView.vue
│       ├── UpstreamsView.vue
│       ├── PluginsView.vue
│       └── TokenAuthView.vue  # JWT credentials, ACL groups, Protect wizard
├── package.json
└── vite.config.ts           # build outDir = ./dashboard
```

---

## การติดตั้งและรัน

### Prerequisites

- Docker + Docker Compose
- Node.js 18+

### 1. รัน Kong + Postgres ด้วย Docker

```bash
# Build dashboard ก่อน (จำเป็น — dashboard/ ถูก gitignore)
npm install
npm run build

# รัน Kong + Postgres + nginx
docker-compose up -d
```

Services ที่รัน:

| Service    | URL                        | คำอธิบาย              |
|------------|----------------------------|-----------------------|
| Kong Proxy | http://localhost:8000      | รับ API requests       |
| Kong Admin | http://localhost:8001      | Admin API             |
| Kong HTTPS | https://localhost:8443     | Kong Proxy (TLS)      |
| Dashboard  | http://localhost:3000      | Admin Dashboard (nginx) |

### 2. Build และ Dev

```bash
# ติดตั้ง dependencies
npm install

# Dev mode (hot reload) — เชื่อม Kong Admin API ที่ localhost:8001
npm run dev

# Build สำหรับ production (output → dashboard/)
npm run build
```

### 3. เข้าใช้งาน Dashboard

เปิด http://localhost:3000 (production) หรือ http://localhost:5173 (dev)

**Login:**
- Kong API URL: `http://localhost:8001`
- Username/Password: ปล่อยว่างถ้าไม่ได้ตั้ง Basic Auth บน Kong Admin API

---

## การใช้งาน Dashboard

| หน้า        | ความสามารถ                                             |
|-------------|-------------------------------------------------------|
| Dashboard   | แสดง Kong node info, stats, server connections        |
| Services    | CRUD services (host, port, protocol, timeout)         |
| Routes      | CRUD routes + เลือก service, methods, paths, protocols |
| Upstreams   | CRUD upstreams + จัดการ targets (host:port, weight)   |
| Plugins     | CRUD plugins + enable/disable toggle                  |
| Token Auth  | จัดการ Consumers, JWT Credentials, ACL Groups + Protect wizard |

---

## Token Auth & Authorization (UI)

หน้า **Token Auth** (`/#/token-auth`) รวมทุกอย่างที่ต้องใช้สำหรับ JWT verification และ ACL authorization ไว้ใน 4 tab

### Tab 1 — 👤 Consumers

จัดการ Kong Consumers (ตัวแทนของ user/application ที่เรียก API)

- เพิ่ม / แก้ไข / ลบ consumer (`username` หรือ `custom_id`)
- ปุ่ม **🔑 JWT** — กดเพื่อข้ามไป Tab JWT Credentials ของ consumer นั้นทันที
- ปุ่ม **🛡️ ACL** — กดเพื่อข้ามไป Tab ACL Groups ของ consumer นั้นทันที

### Tab 2 — 🔑 JWT Credentials

ผูก JWT credential กับ consumer เพื่อให้ Kong สามารถ verify token ได้

| Field | คำอธิบาย |
|-------|----------|
| **Key** (iss) | ต้องตรงกับ `iss` claim ใน JWT Token — กด ⟳ UUID เพื่อ generate อัตโนมัติ |
| **Algorithm** | HS256 / HS384 / HS512 (HMAC) หรือ RS256 / ES256 (asymmetric) |
| **Secret** | HMAC signing secret — กด ⟳ Gen เพื่อ generate random secret |

- แสดง / ซ่อน secret ด้วยปุ่ม 👁️
- Copy key หรือ secret ด้วยปุ่ม ⎘
- หลังสร้าง credential จะแสดง panel สรุปข้อมูลทันที (ควร copy ก่อนปิด)

### Tab 3 — 🛡️ ACL Groups

กำหนด group membership ให้ consumer เพื่อใช้กับ ACL plugin

```
consumer "alice"  →  groups: ["admin", "editor"]
consumer "bob"    →  groups: ["viewer"]
```

- เลือก consumer → ดู group ที่อยู่ทั้งหมด
- เพิ่ม / ลบ group (group name ต้องตรงกับที่ใช้ใน ACL plugin)

### Tab 4 — 🔒 Protect Resource

Wizard สำหรับติด `jwt` plugin และ `acl` plugin ให้ service หรือ route โดยไม่ต้องใช้ curl

**เลือก Target:**

| ประเภท | ผลลัพธ์ |
|--------|---------|
| 🌐 Global | ใช้กับทุก request ผ่าน Kong |
| 📦 Service | ใช้กับ service ที่เลือก ทุก route ของ service นั้น |
| 🛤️ Route | ใช้กับ route เดียวที่เลือก |

**JWT Plugin config:**

| ตัวเลือก | ค่าเริ่มต้น | คำอธิบาย |
|----------|------------|---------|
| Key Claim Name | `iss` | ชื่อ claim ที่ใช้ lookup consumer credential |
| Header Names | `authorization` | HTTP header ที่ส่ง token มา |
| URI Param Names | `jwt` | Query param สำรอง (เช่น `?jwt=...`) |
| Verify `exp` | ✅ | บังคับตรวจ expiry |
| Verify `nbf` | ☐ | บังคับตรวจ not-before |
| Max Expiration | `0` | จำกัด token lifetime (วินาที, 0 = ไม่จำกัด) |

**ACL Plugin config:**

| ตัวเลือก | คำอธิบาย |
|----------|---------|
| Allow groups | เฉพาะ consumer ใน group เหล่านี้เท่านั้นที่ผ่านได้ |
| Deny groups | consumer ใน group เหล่านี้ถูกปฏิเสธเสมอ |

> ⚠️ `jwt` plugin ต้องติดก่อน `acl` plugin จึงจะทำงานร่วมกันได้ (JWT plugin เป็นคนตั้ง consumer context ให้ ACL plugin ใช้)

**Applied Plugins panel:** แสดง plugin ที่ติดอยู่บน target ปัจจุบัน พร้อมปุ่มลบแต่ละตัว

### Request Flow

```
Client
  │  Authorization: Bearer <JWT>
  ▼
Kong Gateway
  │
  ├─[jwt plugin]─────────────────────────────────────────┐
  │   1. ดึง token จาก header/query param               │
  │   2. decode header → หา key_claim (iss)             │
  │   3. lookup JWT credential ใน Kong DB               │
  │   4. verify signature (HMAC secret / RSA public key) │
  │   5. verify exp / nbf (ถ้าตั้งไว้)                  │
  │   6. ตั้ง consumer context                          │
  │                                                      │
  ├─[acl plugin]─────────────────────────────────────────┘
  │   7. อ่าน consumer groups จาก context
  │   8. เทียบกับ allow/deny list
  │   allow → forward request
  │   deny  → 403 Forbidden
  │
  ▼
Upstream Service
```

---

## Verify Token ด้วย Keycloak (curl)

> ทำผ่าน UI ได้ที่หน้า **Token Auth** — ส่วนนี้เป็น reference สำหรับ curl / automation

ใช้ **`jwt` plugin** ของ Kong (รองรับ Kong OSS) ร่วมกับ Keycloak สำหรับ verify Bearer token ทุก request

### Flow

```
Client ──[Bearer Token]──▶ Kong Gateway
                               │
                          [jwt plugin]
                          verify RS256 signature
                          check exp, iss claims
                               │
                     ┌─────────┴─────────┐
                   valid               invalid
                     │                   │
               forward to           401 Unauthorized
               upstream service
```

### ขั้นตอนการตั้งค่า

#### 1. ดึง Public Key จาก Keycloak

```bash
# ดึง Public Key ของ Realm
curl -s https://keycloak.example.com/realms/{realm} \
  | jq -r '.public_key' \
  | awk '{print "-----BEGIN PUBLIC KEY-----\n" $0 "\n-----END PUBLIC KEY-----"}'
```

หรือดึงจาก JWKS endpoint:

```bash
curl https://keycloak.example.com/realms/{realm}/protocol/openid-connect/certs
```

#### 2. สร้าง Consumer ใน Kong

```bash
curl -X POST http://localhost:8001/consumers \
  -d username=keycloak-users
```

#### 3. ผูก JWT Credential กับ Consumer

```bash
curl -X POST http://localhost:8001/consumers/keycloak-users/jwt \
  -d algorithm=RS256 \
  -d "key=https://keycloak.example.com/realms/{realm}" \
  --data-urlencode "rsa_public_key=-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"
```

> ⚠️ `key` ต้องตรงกับ `iss` claim ใน JWT Token ที่ Keycloak ออก

#### 4. เปิด JWT Plugin บน Service หรือ Route

```bash
# ผูกกับ Service ทั้งหมด
curl -X POST http://localhost:8001/services/{service-id}/plugins \
  -d name=jwt \
  -d config.key_claim_name=iss \
  -d config.claims_to_verify=exp \
  -d config.header_names=authorization

# หรือผูกกับ Route เดียว
curl -X POST http://localhost:8001/routes/{route-id}/plugins \
  -d name=jwt \
  -d config.key_claim_name=iss \
  -d config.claims_to_verify=exp
```

#### 5. ทดสอบ

```bash
# ขอ Token จาก Keycloak
TOKEN=$(curl -s -X POST \
  https://keycloak.example.com/realms/{realm}/protocol/openid-connect/token \
  -d grant_type=client_credentials \
  -d client_id=my-client \
  -d client_secret=my-secret \
  | jq -r '.access_token')

# ส่ง Request ผ่าน Kong
curl http://localhost:8000/my-service \
  -H "Authorization: Bearer $TOKEN"
```

---

## Authorization ตาม Role/Scope

Kong OSS ไม่มี claims-based authorization built-in มี 2 วิธีที่นิยม:

### Option A: ACL Plugin (Consumer Groups)

```bash
# กำหนด group ให้ Consumer
curl -X POST http://localhost:8001/consumers/keycloak-users/acls \
  -d group=admin

# ผูก ACL plugin บน Route — อนุญาตเฉพาะ group "admin"
curl -X POST http://localhost:8001/routes/{route-id}/plugins \
  -d name=acl \
  -d "config.allow[]=admin"
```

### Option B: Forward Claims ไปให้ Upstream

ใช้ Kong inject JWT claims เป็น HTTP headers ไปยัง upstream service แล้วให้ service ตัดสินใจเอง:

```bash
curl -X POST http://localhost:8001/routes/{route-id}/plugins \
  -d name=request-transformer \
  -d "config.add.headers[]=X-Consumer-Username:\$(consumer.username)" \
  -d "config.add.headers[]=X-Authenticated-Scope:\$(jwt.scope)"
```

Upstream service อ่าน `X-Consumer-Username` หรือ `X-Authenticated-Scope` header แล้ว authorize ตาม business logic เอง

---

## Plugin ที่แนะนำ

| Plugin               | ใช้สำหรับ                                    | Kong OSS |
|----------------------|----------------------------------------------|----------|
| `jwt`                | Verify JWT token (RS256/HS256)               | ✅        |
| `key-auth`           | API Key authentication                       | ✅        |
| `basic-auth`         | Username/Password authentication             | ✅        |
| `oauth2`             | OAuth 2.0 flows                              | ✅        |
| `acl`                | Role-based access (Consumer groups)          | ✅        |
| `rate-limiting`      | Rate limit requests per consumer/IP          | ✅        |
| `cors`               | Cross-Origin Resource Sharing                | ✅        |
| `request-transformer`| Add/remove/rename headers & body params      | ✅        |
| `openid-connect`     | Full OIDC flow (verify + introspection)      | ❌ Enterprise only |

---

## Notes

- Kong Admin API (`localhost:8001`) ควรปิดไม่ให้ access จาก public internet
- `dashboard/` เป็น build output — ไม่ต้อง commit (เพิ่มใน `.gitignore`)
- Credentials ใน Dashboard เก็บใน `localStorage` ของ browser — ไม่ส่งไปที่ server ใด ๆ นอกจาก Kong Admin API
