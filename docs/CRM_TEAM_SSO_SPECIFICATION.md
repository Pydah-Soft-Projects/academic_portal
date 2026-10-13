# CRM Team SSO Integration Specification & Implementation Guide

This specification provides the CRM development team with the exact requirements, payloads, workflows, and endpoints necessary to integrate the **CRM Gateway** with the **Pydah Academic Portal** via Single Sign-On (SSO).

---

## 1. Architecture & Authentication Flow

```
+---------------+              +--------------------+              +------------------------+
|   User /      |              |    CRM Gateway     |              |     Pydah Academic     |
|   Browser     |              | (Frontend+Backend) |              |  Portal (Next+Express) |
+---------------+              +--------------------+              +------------------------+
        |                                |                                      |
        | 1. Clicks Academic Portal      |                                      |
        |------------------------------->|                                      |
        |                                | 2. User verified in CRM              |
        |                                | 3. Generates encrypted SSO token     |
        | 4. HTTP 302 Redirect to Portal |                                      |
        |<-------------------------------|                                      |
        |    (with ?token=...)           |                                      |
        |                                |                                      |
        | 5. GET /login?token=...        |                                      |
        |---------------------------------------------------------------------->|
        |                                |                                      | 6. Reads ?token from URL
        |                                |                                      | 7. Calls /auth/sso-login
        |                                |                                      |
        |                                | 8. POST /auth/verify-token           |
        |                                |<-------------------------------------|
        |                                | 9. Responds {valid:true, data:{...}} |
        |                                |------------------------------------->|
        |                                |                                      | 10. Maps user to ap_users
        |                                |                                      | 11. Sets HTTP-only ap_sid cookie
        | 12. Redirects to /dashboard    |                                      |
        |<----------------------------------------------------------------------|
```

---

## 2. CRM Side Implementation Requirements

To enable SSO into the Academic Portal, the CRM application must implement two things:

1. **Portal Launcher / Redirect Link Generator**: When the user clicks on the "Academic Portal" tile/card in CRM, generate an encrypted SSO token and redirect the user.
2. **Token Verification Endpoint**: An API endpoint on the CRM backend that the Academic Portal calls to verify the token.

---

## 3. Step 1: Redirecting the User from CRM

When an authenticated user in CRM clicks on the Academic Portal link, CRM should redirect the user's browser to:

### Target URL Format
```text
{ACADEMIC_PORTAL_URL}/login?token={ENCRYPTED_TOKEN}
```

### URLs by Environment
| Environment | Academic Portal Base URL | Example Full Redirect URL |
|---|---|---|
| **Local Development** | `http://localhost:3000` | `http://localhost:3000/login?token=eyJhbGciOi...` |
| **Production** | `https://academic.pydah.edu.in` | `https://academic.pydah.edu.in/login?token=eyJhbGciOi...` |

> **Note on URL encoding**: Ensure the `{ENCRYPTED_TOKEN}` is URL-encoded if it contains special characters (`+`, `/`, `=`, etc.) by using `encodeURIComponent(token)`.

---

## 4. Step 2: CRM Token Verification Endpoint

The Academic Portal backend will call the CRM backend to verify the token received in the URL.

### Endpoint Details
- **Method**: `POST`
- **Path**: `/auth/verify-token`
- **Full URL**: `https://pydah-crm-backend.pydah.edu.in/auth/verify-token`
- **Local Dev URL (Optional)**: `http://localhost:3000/auth/verify-token`
- **Headers**:
  ```http
  Content-Type: application/json
  ```

### Request Body from Academic Portal
```json
{
  "encryptedToken": "base64-or-encrypted-token-string"
}
```

### Response Format (Success - HTTP 200)
```json
{
  "success": true,
  "valid": true,
  "data": {
    "userId": "2145",
    "portalId": "academic-portal",
    "role": "faculty",
    "email": "faculty@pydah.edu.in",
    "employeeId": "2145",
    "expiresAt": "2026-10-13T16:15:00.000Z"
  }
}
```

#### Field Explanations for `data`:
| Field | Type | Required | Description |
|---|---|---|---|
| `userId` | `string` \| `number` | **Yes** | User identifier. Can be the HRMS `emp_no`, employee ID, email, or MongoDB ObjectId. |
| `portalId` | `string` | **Yes** | Identifier for this portal: `"academic-portal"` (or `"student-portal"`). |
| `role` | `string` | Optional | User role in CRM (e.g., `"faculty"`, `"hod"`, `"admin"`). Academic Portal permissions are governed by internal RBAC. |
| `email` | `string` | Optional (Recommended) | User's official email address. Helps resolve the user in Academic Portal. |
| `employeeId` | `string` \| `number` | Optional (Recommended) | HRMS employee number (e.g. `2145`). Matches `ap_users.hrms_employee_id`. |
| `expiresAt` | `string` (ISO 8601) | **Yes** | ISO-8601 timestamp when the token expires (e.g. `"2026-10-13T16:15:00.000Z"`). |

### Response Format (Invalid / Expired - HTTP 200 or 401)
```json
{
  "success": false,
  "valid": false,
  "message": "Invalid or expired token"
}
```

---

## 5. Token Security & Best Practices for CRM

1. **Short Lifespan**: SSO tokens should be short-lived (5 to 15 minutes maximum). The token is only needed for the brief moment of handoff between CRM and the portal.
2. **One-Time Use (Recommended)**: Once a token has been validated via `/auth/verify-token`, CRM should invalidate or blacklist the token to prevent replay attacks.
3. **Encryption / Signature**:
   - If using AES-256 encryption, encrypt the payload with CRM's secret key.
   - If using JWT, sign with CRM's secret key (`HS256` or `RS256`).
4. **HTTPS in Production**: Always use HTTPS in production environments for both CRM and Academic Portal to protect tokens in transit.

---

## 6. Example CRM Implementation Snippets

### Node.js / Express Example (CRM Backend)

```javascript
// routes/auth.js in CRM Backend
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // or your encryption library

// CRM Token Verification Endpoint
router.post('/auth/verify-token', async (req, res) => {
  try {
    const { encryptedToken } = req.body;

    if (!encryptedToken) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'encryptedToken is required'
      });
    }

    // Verify token (example using JWT or custom decryption)
    let payload;
    try {
      payload = jwt.verify(encryptedToken, process.env.CRM_SSO_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        valid: false,
        message: err.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token signature'
      });
    }

    // Check target portal
    if (payload.portalId && payload.portalId !== 'academic-portal') {
      return res.status(403).json({
        success: false,
        valid: false,
        message: 'Token was not issued for Academic Portal'
      });
    }

    return res.json({
      success: true,
      valid: true,
      data: {
        userId: payload.userId,
        portalId: payload.portalId || 'academic-portal',
        role: payload.role,
        email: payload.email,
        employeeId: payload.employeeId || payload.empNo,
        expiresAt: new Date(payload.exp * 1000).toISOString()
      }
    });
  } catch (error) {
    console.error('SSO verify-token error:', error);
    return res.status(500).json({
      success: false,
      valid: false,
      message: 'Internal server error during token verification'
    });
  }
});

// CRM Token Generator Helper (when user clicks Portal card in CRM)
function generateAcademicPortalToken(user) {
  const payload = {
    userId: user.employeeId || user.id,
    email: user.email,
    employeeId: user.employeeId || user.empNo,
    role: user.role,
    portalId: 'academic-portal',
  };

  // 10-minute validity
  return jwt.sign(payload, process.env.CRM_SSO_SECRET, { expiresIn: '10m' });
}
```

---

## 7. Testing Checklist for the CRM Team

### Test 1: Verify Token API (cURL)
Test your verify-token endpoint using curl:
```bash
curl -X POST http://localhost:3000/auth/verify-token \
  -H "Content-Type: application/json" \
  -d '{"encryptedToken":"YOUR_TEST_TOKEN"}'
```

### Test 2: Full End-to-End Browser Flow
1. Log in to CRM Gateway.
2. Click on the **Academic Portal** link / card.
3. Observe that browser navigates to `http://localhost:3000/login?token={TOKEN}`.
4. Academic Portal will display `"Verifying Single Sign-On..."`.
5. Upon verification, Academic Portal automatically logs in and redirects to `/dashboard`.
6. Test with an expired or invalid token to verify that the portal displays a graceful error message and a `"Return to CRM Portal"` button.

---

## 8. Summary of Academic Portal Endpoints & Configurations

| Key | Value / Details |
|---|---|
| **Portal Login Path** | `/login?token={TOKEN}` |
| **Portal Backend SSO Endpoints** | `POST /api/auth/sso-login`, `POST /api/auth/sso-session` |
| **Backend Environment Variable** | `CRM_BACKEND_URL=https://pydah-crm-backend.pydah.edu.in` |
| **Frontend Environment Variable** | `NEXT_PUBLIC_CRM_FRONTEND_URL=https://crm.pydah.edu.in` |
| **Cookie Created** | `ap_sid` (HTTP-only session cookie) |
