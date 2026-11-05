# QuickCart - E-Commerce Web Application

A full-stack online store: product catalog, cart, checkout, order tracking, JWT login and role-based access (Admin / User).

**Stack:** Node.js, Express, MongoDB (Mongoose), JWT, bcrypt, vanilla HTML/CSS/JS frontend.

## Features
- Product catalog with search and category filter
- Cart (saved in browser), checkout with shipping address
- Register / Login with JWT; roles: `user` and `admin`
- Users: place orders, track status, cancel while Pending
- Admin: add / edit / delete products, view all orders, update order status
- Stock is reduced atomically on order and restored on cancellation
- Prices are always taken from the database (client cannot tamper with them)

## Setup
1. Install Node.js (v18+) and MongoDB (local) or use a MongoDB Atlas URI.
2. In this folder:
   ```
   npm install
   ```
3. Edit `.env` (copy of `.env.example`) - set `MONGO_URI` and a strong `JWT_SECRET`.
4. Load sample data (creates admin, demo user, 6 products):
   ```
   npm run seed
   ```
5. Start:
   ```
   npm start
   ```
6. Open http://localhost:5000

**Demo logins**
- Admin: `admin@store.com` / `admin123`
- User: `user@store.com` / `user123`

## Folder Structure
```
ecommerce-app/
├── server.js            # Express app entry
├── seed.js              # Sample data
├── config/db.js         # MongoDB connection
├── models/              # User, Product, Order schemas
├── middleware/auth.js   # JWT protect + adminOnly
├── routes/              # auth, products, orders APIs
└── public/              # Frontend (index.html, css, js)
```

## API Reference
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | /api/auth/register | Public | Create user account |
| POST | /api/auth/login | Public | Login, returns JWT |
| GET | /api/auth/me | User | Current user |
| GET | /api/products | Public | List (query: `q`, `category`) |
| GET | /api/products/:id | Public | Single product |
| POST | /api/products | Admin | Create product |
| PUT | /api/products/:id | Admin | Update product |
| DELETE | /api/products/:id | Admin | Delete product |
| POST | /api/orders | User | Checkout / create order |
| GET | /api/orders/mine | User | My orders |
| PUT | /api/orders/:id/cancel | User | Cancel own Pending order |
| GET | /api/orders | Admin | All orders |
| PUT | /api/orders/:id/status | Admin | Update order status |

Send the token as `Authorization: Bearer <token>`.

## Deployment
Push to GitHub, deploy on Render / Railway / Heroku, and set `MONGO_URI` (MongoDB Atlas) and `JWT_SECRET` as environment variables.
