import { eq } from 'drizzle-orm';
import { settings, type Db } from '@invoices/db';
import { settingsInputSchema, signatureUploadSchema, smtpPasswordSchema } from '@invoices/shared';
import { authedProcedure, router } from '../trpc';
import { encryptSecret } from '../../crypto/crypto.service';
import { env } from '../../env';

async function readSettings(db: Db, userId: string) {
  const [row] = await db.select().from(settings).where(eq(settings.userId, userId));
  const { smtpPasswordEnc, signatureImage, ...rest } = row;
  return {
    ...rest,
    hasSmtpPassword: smtpPasswordEnc != null,
    hasSignature: signatureImage != null,
  };
}

export const settingsRouter = router({
  get: authedProcedure.query(({ ctx }) => readSettings(ctx.db, ctx.userId)),
  update: authedProcedure.input(settingsInputSchema).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(settings)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(settings.userId, ctx.userId));
    return readSettings(ctx.db, ctx.userId);
  }),
  setSmtpPassword: authedProcedure.input(smtpPasswordSchema).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(settings)
      .set({ smtpPasswordEnc: encryptSecret(input.password, env.appSecret), updatedAt: new Date() })
      .where(eq(settings.userId, ctx.userId));
    return { ok: true };
  }),
  uploadSignature: authedProcedure.input(signatureUploadSchema).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(settings)
      .set({
        signatureImage: Buffer.from(input.dataBase64, 'base64'),
        signatureMimeType: input.mimeType,
        updatedAt: new Date(),
      })
      .where(eq(settings.userId, ctx.userId));
    return { ok: true };
  }),
  deleteSignature: authedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(settings)
      .set({ signatureImage: null, signatureMimeType: null, updatedAt: new Date() })
      .where(eq(settings.userId, ctx.userId));
    return { ok: true };
  }),
});
