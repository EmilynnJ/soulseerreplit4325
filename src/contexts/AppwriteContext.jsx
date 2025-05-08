&lt;code&gt;import React, { createContext, useContext } from &#39;react&#39;
import { Client, Account } from &#39;appwrite&#39;

const AppwriteContext = createContext()

export const useAppwrite = () =&gt; useContext(AppwriteContext)

export const AppwriteProvider = ({ children }) =&gt; {
  const client = new Client()
    .setEndpoint(import.meta.env.VITE_APPWRITE_API_ENDPOINT)
    .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID)

  const account = new Account(client)

  return (
    &lt;AppwriteContext.Provider value={{ client, account }}&gt;
      {children}
    &lt;/AppwriteContext.Provider&gt;
  )
}&lt;/code&gt;