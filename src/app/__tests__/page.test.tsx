/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Home from '../page'

describe('Home Page', () => {
  it('renders welcome message', () => {
    render(<Home />)
    
    const welcomeHeading = screen.getByRole('heading', {
      name: /welcome to agentapi ui/i,
    })
    
    expect(welcomeHeading).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    render(<Home />)
    
    expect(screen.getByText('AgentAPI Chat')).toBeInTheDocument()
    expect(screen.getByText('Agents')).toBeInTheDocument()
    expect(screen.getByText('Metrics')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders interface description', () => {
    render(<Home />)
    
    const description = screen.getByText(/a powerful ui for interacting with agentapi/i)
    expect(description).toBeInTheDocument()
  })
})