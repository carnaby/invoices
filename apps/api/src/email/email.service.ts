import nodemailer, { type Transporter } from 'nodemailer';
import { TRPCError } from '@trpc/server';
import type { settings } from '@invoices/db';
import { decryptSecret } from '../crypto/crypto.service';

type SettingsRow = typeof settings.$inferSelect;

export interface SmtpConfig {
  host: string; port: number; secure: boolean;
  user?: string | null; password?: string | null; from: string;
}

export function smtpConfigFromSettings(row: SettingsRow, appSecret: string): SmtpConfig {
  if (!row.smtpHost || !row.smtpPort || !row.emailFrom) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'SMTP nie je nakonfigurované — vyplňte Nastavenia' });
  }
  return {
    host: row.smtpHost, port: row.smtpPort, secure: row.smtpSecure,
    user: row.smtpUser,
    password: row.smtpPasswordEnc ? decryptSecret(row.smtpPasswordEnc, appSecret) : null,
    from: row.emailFrom,
  };
}

export type TransportFactory = (cfg: SmtpConfig) => Transporter;
let transportFactory: TransportFactory | null = null;
export function setTransportFactory(f: TransportFactory | null) { transportFactory = f; }

function createTransport(cfg: SmtpConfig): Transporter {
  if (transportFactory) return transportFactory(cfg);
  return nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure,
    auth: cfg.user && cfg.password ? { user: cfg.user, pass: cfg.password } : undefined,
  });
}

export async function sendMail(
  cfg: SmtpConfig,
  mail: { to: string[]; cc?: string[]; subject: string; text: string;
          attachments?: { filename: string; content: Buffer }[] },
): Promise<void> {
  const transport = createTransport(cfg);
  await transport.sendMail({ from: cfg.from, ...mail });
}
