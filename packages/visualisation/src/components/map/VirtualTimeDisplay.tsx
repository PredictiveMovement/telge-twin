import React from 'react'

interface VirtualTimeDisplayProps {
  virtualTime: number | null
  format?: 'time' | 'datetime' | 'elapsed'
  showLabel?: boolean
  className?: string
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

export const VirtualTimeDisplay: React.FC<VirtualTimeDisplayProps> = ({
  virtualTime,
  format = 'datetime',
  showLabel = true,
  className = '',
  position = 'top-right',
}) => {
  const getPositionStyles = () => {
    const baseStyles = {
      position: 'absolute' as const,
      background: 'rgba(255, 255, 255, 0.95)',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      zIndex: 1000,
    }

    switch (position) {
      case 'top-right':
        return { ...baseStyles, top: '20px', right: '20px' }
      case 'top-left':
        return { ...baseStyles, top: '20px', left: '20px' }
      case 'bottom-right':
        return { ...baseStyles, bottom: '20px', right: '20px' }
      case 'bottom-left':
        return { ...baseStyles, bottom: '20px', left: '20px' }
      default:
        return { ...baseStyles, top: '20px', right: '20px' }
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)

    switch (format) {
      case 'time':
        return date.toLocaleTimeString('sv-SE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      case 'datetime':
        return date.toLocaleString('sv-SE', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      case 'elapsed':
        const midnight = new Date(date)
        midnight.setHours(0, 0, 0, 0)
        const elapsed = date.getTime() - midnight.getTime()
        const hours = Math.floor(elapsed / (1000 * 60 * 60))
        const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60))
        return `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}`
      default:
        return date.toLocaleString('sv-SE')
    }
  }

  if (!virtualTime) {
    return (
      <div style={getPositionStyles()} className={className}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {showLabel && (
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Virtual tid
            </div>
          )}
          <div
            style={{ fontSize: '13px', fontWeight: '500', color: '#9ca3af' }}
          >
            --:--
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={getPositionStyles()} className={className}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {showLabel && (
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Virtual tid</div>
        )}
        <div style={{ fontSize: '13px', fontWeight: '500' }}>
          {formatTime(virtualTime)}
        </div>
      </div>
    </div>
  )
}
