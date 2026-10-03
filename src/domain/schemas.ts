import { z } from 'zod'
import { PASSWORD_MIN_LENGTH } from '../config/businessConfig'
import { MAX_IMAGES_PER_PRODUCT } from '../config/businessConfig'

export const validationMessage = {
  required: 'validation.required',
  email: 'validation.email',
  phone: 'validation.phone',
  password: 'validation.password',
  confirmPassword: 'validation.confirmPassword',
  length: 'validation.length',
} as const

export function normalizeEgyptianPhone(value: string): string {
  const trimmed = value.trim()
  const digits = trimmed.replace(/[\s-]/g, '')
  if (digits.startsWith('+20')) return `0${digits.slice(3)}`
  return digits
}

const requiredString = (field: string) =>
  z.string().trim().min(1, { message: validationMessage.required })

const name = requiredString('name').refine((value) => value.length >= 2 && value.length <= 60, {
  message: validationMessage.length,
})

const email = requiredString('email').email({ message: validationMessage.email }).transform((value) => value.toLowerCase())

const phone = requiredString('phone')
  .transform(normalizeEgyptianPhone)
  .refine((value) => /^01[0125][0-9]{8}$/.test(value), { message: validationMessage.phone })

const password = z.string().min(PASSWORD_MIN_LENGTH, { message: validationMessage.password })
  .regex(/[A-Za-z]/, { message: validationMessage.password })
  .regex(/[0-9]/, { message: validationMessage.password })

export const registerSchema = z.object({
  name,
  email,
  phone,
  password,
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  path: ['confirmPassword'],
  message: validationMessage.confirmPassword,
})

export const loginSchema = z.object({ email, password: z.string().min(1, { message: validationMessage.required }) })
export const forgotPasswordSchema = z.object({ email })
export const resetPasswordSchema = z.object({ password, confirmPassword: z.string() }).refine((value) => value.password === value.confirmPassword, {
  path: ['confirmPassword'],
  message: validationMessage.confirmPassword,
})
export const profileSchema = z.object({ name, phone })
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: validationMessage.required }),
  password,
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  path: ['confirmPassword'],
  message: validationMessage.confirmPassword,
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ProfileInput = z.infer<typeof profileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export const governorateKeys = [
  'Cairo', 'Giza', 'Alexandria', 'Dakahlia', 'Red Sea', 'Beheira', 'Fayoum',
  'Gharbia', 'Ismailia', 'Menofia', 'Minya', 'Qaliubiya', 'New Valley', 'Suez',
  'Aswan', 'Assiut', 'Beni Suef', 'Port Said', 'Damietta', 'Sharkia',
  'South Sinai', 'Kafr El Sheikh', 'Matrouh', 'Luxor', 'Qena', 'North Sinai', 'Sohag',
] as const

export const addressSchema = z.object({
  fullName: z.string().trim().min(1, { message: validationMessage.required }).refine((value) => value.length >= 2 && value.length <= 80, { message: validationMessage.length }),
  phone,
  governorate: z.enum(governorateKeys, { message: validationMessage.required }),
  city: z.string().trim().min(1, { message: validationMessage.required }).max(80),
  street: z.string().trim().min(1, { message: validationMessage.required }).max(120),
  building: z.string().trim().min(1, { message: validationMessage.required }).max(60),
  notes: z.string().trim().max(200).nullable().or(z.literal('')).transform((value) => value || null),
})

export type AddressInput = z.infer<typeof addressSchema>

const productEnum = (values: readonly string[]) => z.string().refine((value) => values.includes(value), { message: validationMessage.required })

export const productSchema = z.object({
  sku: z.string().trim().regex(/^[A-Z0-9-]{3,30}$/, { message: 'validation.sku' }),
  nameAr: z.string().trim().min(2, { message: validationMessage.length }).max(120, { message: validationMessage.length }),
  nameEn: z.string().trim().min(2, { message: validationMessage.length }).max(120, { message: validationMessage.length }),
  brand: z.string().trim().min(1, { message: validationMessage.required }).max(60, { message: validationMessage.length }),
  descriptionAr: z.string().max(5000, { message: validationMessage.length }),
  descriptionEn: z.string().max(5000, { message: validationMessage.length }),
  price: z.number().int().positive({ message: 'validation.price' }),
  stock: z.number().int().min(0, { message: 'validation.stock' }),
  lowStockThresholdOverride: z.number().int().min(0).nullable(),
  specs: z.object({
    caseSize: z.number().positive(),
    waterResistance: z.number().min(0),
    movement: productEnum(['automatic', 'manual', 'quartz']),
    material: productEnum(['stainless_steel', 'gold', 'rose_gold', 'titanium', 'ceramic', 'other']),
    strap: productEnum(['leather', 'steel', 'rubber', 'fabric', 'other']),
    gender: productEnum(['men', 'women', 'unisex']),
  }),
  featured: z.boolean(),
}).superRefine((value, context) => {
  if (value.featured && value.stock < 0) context.addIssue({ code: 'custom', path: ['featured'], message: validationMessage.required })
})

export type ProductInput = z.infer<typeof productSchema>
export const MAX_PRODUCT_IMAGES = MAX_IMAGES_PER_PRODUCT
