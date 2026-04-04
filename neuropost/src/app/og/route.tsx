import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(_req: NextRequest): Promise<ImageResponse> {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#0f0e0c',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Subtle radial glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(255,92,26,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Logo dot + wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '32px',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#ff5c1a',
            }}
          />
          <span
            style={{
              fontSize: '72px',
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            NeuroPost
          </span>
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '28px',
            color: '#ff5c1a',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            margin: 0,
            position: 'relative',
          }}
        >
          Tu negocio en redes, sin esfuerzo
        </p>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}
