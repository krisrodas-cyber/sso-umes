import { getSession } from '../services/authService.js'

export const authGuard = async () => {
  try { return Boolean(await getSession()) } catch (error) {
    console.error('No fue posible validar la sesión.', error)
    return false
  }
}
