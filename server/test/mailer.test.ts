import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

async function loadMailer() {
  vi.resetModules();
  vi.doMock('../src/config/env.ts', () => ({
    default: {
      NODE_ENV: 'production',
      OTP_EXPIRES_MINUTES: 10,
      MAILJET_SEND_URL: 'https://mail.example.test/send',
      MAILJET_API_KEY: 'api-key',
      MAILJET_SECRET_KEY: 'secret-key',
      MAILJET_TIMEOUT_MS: 1_000,
      MAIL_FROM_EMAIL: 'noreply@example.com',
      MAIL_FROM_NAME: 'PadosiPro'
    }
  }));
  return import('../src/utils/mailer.ts');
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('mailer', () => {
  it('sends the verification email with authentication and the OTP', async () => {
    const { sendOtp } = await loadMailer();
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: vi.fn() });

    await sendOtp('user@example.com', '012345');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://mail.example.test/send');
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from('api-key:secret-key').toString('base64')}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    });

    const body = JSON.parse(String(options.body));
    expect(body.Messages[0].To).toEqual([{ Email: 'user@example.com' }]);
    expect(body.Messages[0].TextPart).toContain('012345');
    expect(body.Messages[0].HTMLPart).toContain('012345');
  });

  it('rejects non-success responses with bounded response details', async () => {
    const { sendOtp } = await loadMailer();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: vi.fn().mockResolvedValue('x'.repeat(5_000))
    });

    await expect(sendOtp('user@example.com', '012345')).rejects.toMatchObject({
      code: 'MAILJET_API_ERROR',
      statusCode: 422,
      responseBody: 'x'.repeat(2_000)
    });
  });

  it('handles failure reading an error response body', async () => {
    const { sendOtp } = await loadMailer();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockRejectedValue(new Error('read failed'))
    });

    await expect(sendOtp('user@example.com', '012345')).rejects.toMatchObject({
      code: 'MAILJET_API_ERROR',
      statusCode: 500,
      responseBody: ''
    });
  });

  it('converts an aborted Mailjet request into a timeout error', async () => {
    const { sendOtp } = await loadMailer();
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      const signal = options.signal as AbortSignal;
      signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    }));

    const assertion = expect(sendOtp('user@example.com', '012345')).rejects.toMatchObject({
      code: 'MAILJET_TIMEOUT',
      message: 'Mailjet request timeout'
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it('passes through non-abort network errors', async () => {
    const { sendOtp } = await loadMailer();
    const networkError = new Error('socket reset');
    fetchMock.mockRejectedValue(networkError);

    await expect(sendOtp('user@example.com', '012345')).rejects.toBe(networkError);
  });
});
