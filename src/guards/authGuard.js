import { getSession } from '../services/authService.js'

export const authGuard = async () => {
  return getSession()
}
