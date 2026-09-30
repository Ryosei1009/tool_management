import { createContext, useContext } from 'react'

export const AuthContext = createContext({
    user: null,
    loading: true,
    error: '',
    reload: () => {},
})

export const useAuth = () => useContext(AuthContext)
