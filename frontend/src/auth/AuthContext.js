import { createContext, useContext } from 'react'

export const AuthContext = createContext({
    user: null,
    loading: true,
    error: '',
    reload: () => {},
    signOut: () => {},
})

export const useAuth = () => useContext(AuthContext)
