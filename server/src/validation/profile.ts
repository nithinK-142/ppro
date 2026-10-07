import { z } from 'zod';

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  mobile: z.string().regex(/^\+91\d{10}$/, { error: 'Mobile number must be in +91XXXXXXXXXX format' }),
  address: z.string().trim().min(5).max(300),
  businessName: z.string().trim().max(120).optional().or(z.literal(''))
});

export { profileSchema };
