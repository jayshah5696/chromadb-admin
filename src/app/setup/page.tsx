'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Container, Title, Paper, TextInput, Group, Button, Radio, Text, SegmentedControl } from '@mantine/core'

import { useGetConfig } from '@/lib/client/query'
import { updateConfig } from '@/lib/client/localstorage'

export default function SetupPage() {
  const router = useRouter()
  const { data: appConfig } = useGetConfig()
  const [connectionString, setConnectionString] = useState(appConfig?.connectionString || '')
  const [tenant, setTenant] = useState(appConfig?.tenant || 'default_tenant')
  const [database, setDatabase] = useState(appConfig?.database || 'default_database')
  const [authType, setAuthType] = useState(appConfig?.authType || 'no_auth')
  const [username, setUsername] = useState(appConfig?.username || '')
  const [password, setPassword] = useState(appConfig?.password || '')
  const [token, setToken] = useState(appConfig?.token || '')
  const [embeddingModelUrl, setEmbeddingModelUrl] = useState(appConfig?.embeddingModelUrl || '')
  const [embeddingModel, setEmbeddingModel] = useState(appConfig?.embeddingModel || 'text-embedding-3-small')
  const [apiVersion, setApiVersion] = useState(appConfig?.apiVersion || 'v1')

  useEffect(() => {
    if (appConfig != null && appConfig.connectionString) {
      setConnectionString(appConfig.connectionString)
    }
    if (appConfig?.apiVersion) {
      setApiVersion(appConfig.apiVersion)
    }
  }, [appConfig])

  const queryClient = useQueryClient()

  const connectButtonClicked = () => {
    let formattedConnectionString = connectionString.trim()

    try {
      // Add http:// if no protocol specified
      if (!formattedConnectionString.startsWith('http://') && !formattedConnectionString.startsWith('https://')) {
        formattedConnectionString = 'http://' + formattedConnectionString
      }

      // Parse the URL
      const url = new URL(formattedConnectionString)

      // Only add default port 8000 for localhost/127.0.0.1 http connections
      // Remote hosts may use standard ports (80/443) or custom ports specified by the user
      if (!url.port && url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
        url.port = '8000'
        formattedConnectionString = url.toString()
      }

      // Remove trailing slash if exists
      formattedConnectionString = formattedConnectionString.replace(/\/$/, '')
    } catch (error) {
      console.error(error)
      alert('Invalid connection string format. Please use format: http://hostname:port or https://hostname:port')
      return
    }

    updateConfig({
      connectionString: formattedConnectionString,
      authType,
      username,
      password,
      token,
      currentCollection: '',
      tenant,
      database,
      embeddingModelUrl,
      embeddingModel,
      apiVersion,
    })
    queryClient.setQueryData(['config'], {
      connectionString: formattedConnectionString,
      tenant,
      database,
      embeddingModelUrl,
      embeddingModel,
      apiVersion,
    })
    router.push('/collections')
  }

  const backButtonClicked = () => {
    router.push('/collections')
  }

  const inputStyles = {
    input: {
      backgroundColor: '#3c3c3c',
      borderColor: '#3c3c3c',
      color: '#cccccc',
      fontFamily: 'var(--font-mono), monospace',
      fontSize: '13px',
    },
    label: {
      color: '#cccccc',
      fontSize: '13px',
    },
    description: {
      color: '#858585',
      fontSize: '12px',
    },
  }

  return (
    <div style={{ background: '#1e1e1e', minHeight: '100vh', overflow: 'auto' }}>
      <Container size={480} py={40}>
        <Title order={2} ta="center" style={{ color: '#cccccc', fontWeight: 500 }}>
          ChromaDB Admin
        </Title>
        <Text ta="center" size="sm" mt={4} style={{ color: '#858585' }}>
          Configure your connection
        </Text>
        <Paper
          p={24}
          radius={4}
          mt="xl"
          style={{
            backgroundColor: '#252526',
            border: '1px solid #3c3c3c',
          }}
        >
          <TextInput
            label="Chroma connection string"
            description="For example, http://localhost:8000"
            placeholder="http://localhost:8000"
            value={connectionString}
            onChange={e => setConnectionString(e.currentTarget.value)}
            styles={inputStyles}
          />
          <div style={{ marginTop: 16 }}>
            <Text size="sm" style={{ color: '#cccccc', fontSize: '13px', marginBottom: 4 }}>
              API Version
            </Text>
            <Text size="xs" style={{ color: '#858585', fontSize: '12px', marginBottom: 8 }}>
              ChromaDB &lt; 0.6.0 uses v1, ChromaDB &gt;= 0.6.0 uses v2
            </Text>
            <SegmentedControl
              value={apiVersion}
              onChange={setApiVersion}
              data={[
                { label: 'v1 (legacy)', value: 'v1' },
                { label: 'v2 (new)', value: 'v2' },
              ]}
              styles={{
                root: { backgroundColor: '#3c3c3c' },
                label: { color: '#cccccc', fontSize: '13px' },
                indicator: { backgroundColor: '#094771' },
              }}
            />
          </div>
          <TextInput
            label="Tenant"
            description="The tenant to set."
            placeholder="default_tenant"
            value={tenant}
            onChange={e => setTenant(e.currentTarget.value)}
            mt="md"
            styles={inputStyles}
          />
          <TextInput
            label="Database"
            description="The database to set."
            placeholder="default_database"
            value={database}
            onChange={e => setDatabase(e.currentTarget.value)}
            mt="md"
            styles={inputStyles}
          />
          <TextInput
            label="Embedding Model URL (Optional)"
            description="LM Studio: http://localhost:1234/v1/embeddings | Ollama: http://localhost:11434/v1"
            placeholder="http://localhost:1234/v1/embeddings"
            value={embeddingModelUrl}
            onChange={e => setEmbeddingModelUrl(e.currentTarget.value)}
            mt="md"
            styles={inputStyles}
          />
          <TextInput
            label="Embedding Model (Optional)"
            description="Model name, e.g.: text-embedding-3-small or llama2"
            placeholder="text-embedding-3-small"
            value={embeddingModel}
            onChange={e => setEmbeddingModel(e.currentTarget.value)}
            mt="md"
            styles={inputStyles}
          />
          <Radio.Group
            label="Authentication Type"
            value={authType}
            onChange={setAuthType}
            mt="md"
            styles={{
              label: { color: '#cccccc', fontSize: '13px' },
            }}
          >
            <Group mt="xs">
              <Radio value="no_auth" label="No Auth" styles={{ label: { color: '#cccccc' } }} />
              <Radio value="token" label="Token" styles={{ label: { color: '#cccccc' } }} />
              <Radio value="basic" label="Basic" styles={{ label: { color: '#cccccc' } }} />
            </Group>
          </Radio.Group>
          {authType === 'token' && (
            <TextInput
              label="Token"
              placeholder="Enter your token"
              mt="md"
              value={token}
              onChange={e => setToken(e.currentTarget.value)}
              styles={inputStyles}
            />
          )}
          {authType === 'basic' && (
            <div>
              <TextInput
                label="Username"
                placeholder="Enter your username"
                mt="md"
                value={username}
                onChange={e => setUsername(e.currentTarget.value)}
                styles={inputStyles}
              />
              <TextInput
                label="Password"
                placeholder="Enter your password"
                mt="md"
                value={password}
                onChange={e => setPassword(e.currentTarget.value)}
                type="password"
                styles={inputStyles}
              />
            </div>
          )}
          <Group mt="lg" justify="flex-end">
            {appConfig?.connectionString && (
              <Button
                variant="default"
                onClick={backButtonClicked}
                styles={{
                  root: { backgroundColor: '#3c3c3c', borderColor: '#3c3c3c', color: '#cccccc' },
                }}
              >
                Back
              </Button>
            )}
            <Button
              onClick={connectButtonClicked}
              styles={{
                root: { backgroundColor: '#007acc', borderColor: '#007acc' },
              }}
            >
              Connect
            </Button>
          </Group>
        </Paper>
      </Container>
    </div>
  )
}
