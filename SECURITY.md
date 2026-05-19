# Security Policy

## Reporting Security Issues

We take security seriously. If you discover a security vulnerability in this project, please **do not** create a public GitHub issue. Instead, please report it responsibly to:

📧 **[tryrelia1@gmail.com](mailto:tryrelia1@gmail.com)**

Please include:
- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if available)

We will acknowledge receipt of your report within 48 hours and provide updates on our progress towards a fix.

---

## Current Security Scan Report

A security scan of this project has been completed and is available at:

🔍 **[Relia Security Scan Report](https://tryrelia.com/sample-project/relia_Kg8k0Qi0W0Qn55Y-vNB1HDYaDybGtSf5cwl68Jq450SYUIYUD60RoXBFzOSOS0S2)**

### Scan Summary

- **Features Scanned:** 4
- **Issues Found:** 4
- **Critical Issues:** 1
- **Warnings:** 3
- **Secrets Detected:** 0
- **Reliability Issues:** 1

### Known Issues

#### 🔴 Critical: Insecure Storage
**Issue:** API keys stored in browser localStorage

- **Location:** `components/chat-layout-wrapper.tsx:68`
- **Risk:** API keys are accessible from client-side JavaScript and vulnerable to XSS (Cross-Site Scripting) attacks
- **Current Status:** By design for this development/demo tool
- **Recommendation:** For production use, implement a backend authentication layer with secure session management

### Security Considerations

⚠️ **Important:** This project is designed as a development, experimentation, and demo tool. It is **not recommended** for production use with sensitive data without significant security hardening.

#### Current Architecture Risks

1. **Browser Storage Exposure**
   - API keys and settings stored in `localStorage` and `IndexedDB`
   - Accessible to XSS attacks
   - Not encrypted

2. **XSS Vectors**
   - Client-side rendering of untrusted content
   - Potential injection points in chat responses

3. **Insecure Defaults**
   - No rate limiting
   - No input validation on sensitive fields

#### Mitigation Strategies

For development/demo environments:
- Use isolated browser profiles
- Run in containerized environments
- Restrict to localhost access
- Use read-only API keys when possible

For production deployment:
- Implement backend API authentication
- Use secure HTTP-only cookies for sessions
- Add input validation and sanitization
- Implement CSRF protection
- Add rate limiting
- Use API key encryption
- Implement proper error handling to avoid information disclosure
- Regular security audits and dependency updates

---

## Dependency Security

We regularly update dependencies to address known vulnerabilities. To check for vulnerabilities in your local installation:

```bash
npm audit
npm audit fix
```

---

## Security Best Practices for Users

When using this tool:

1. **Use HTTPS only** — Always access via HTTPS in production
2. **Keep browser updated** — Use the latest version with security patches
3. **Avoid sensitive data** — Don't query or expose PII through this interface
4. **Use read-only keys** — Limit PostHog API key permissions when possible
5. **Rotate keys regularly** — Periodically refresh API keys
6. **Monitor access** — Review PostHog activity logs for unauthorized access

---

## Version History

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| 1.0.0 | 2026 | Current | Initial release with known browser storage vulnerabilities |

---

## Acknowledgements

- Security scan performed by [Relia](https://tryrelia.com)
- Report generated: May 2026
- Based on [OWASP Top 10](https://owasp.org/Top10/) best practices

---

## Additional Resources

- [OWASP WebGoat - Secure Storage](https://owasp.org/WebGoat/)
- [MDN: Securing Sensitive Data](https://developer.mozilla.org/en-US/docs/Web/Security)
- [PostHog Security](https://posthog.com/security)
- [Model Context Protocol Security](https://modelcontextprotocol.io/)
