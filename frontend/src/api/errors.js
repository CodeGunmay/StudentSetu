/**
 * The one error type the screens know about.
 *
 * `field` is what turns a message into an inline error under a specific input;
 * `status` mirrors the C++ server's code (400/401/403/404/409/429) so a screen
 * can react to the *kind* of failure; anything else the server sent (needsVerify,
 * devOtp) is spread onto the error so the auth screens can read it.
 */
export class ApiError extends Error {
  constructor(message, field = null, extra = {}) {
    super(message);
    this.name = 'ApiError';
    this.field = field ?? extra.field ?? null;
    this.status = extra.status ?? null;
    Object.assign(this, extra);
    this.message = message;
  }
}
