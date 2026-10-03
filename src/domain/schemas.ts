import { z } from 'zod'
import { PASSWORD_MIN_LENGTH } from '../config/businessConfig'

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

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
