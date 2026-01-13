import { useEffect, useRef, useState } from 'react'

interface VenueAutocompleteProps {
  venueName: string
  venueAddress: string
  onVenueNameChange: (name: string) => void
  onVenueAddressChange: (address: string) => void
  apiKey?: string
}

declare global {
  interface Window {
    google: any
    initGooglePlaces: () => void
  }
}

export default function VenueAutocomplete({
  venueName,
  venueAddress,
  onVenueNameChange,
  onVenueAddressChange,
  apiKey,
}: VenueAutocompleteProps) {
  const autocompleteRef = useRef<HTMLInputElement>(null)
  const autocompleteInstanceRef = useRef<any>(null)
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{ name: string; address: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Google Maps APIの読み込み
  useEffect(() => {
    if (!apiKey) {
      console.warn('Google Maps API key is not set. Autocomplete will not work.')
      return
    }

    if (window.google && window.google.maps && window.google.maps.places) {
      setIsGoogleLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=ja`
    script.async = true
    script.defer = true
    script.onload = () => {
      setIsGoogleLoaded(true)
    }
    document.head.appendChild(script)

    return () => {
      // クリーンアップ
      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
      if (existingScript) {
        // スクリプトは残しておく（他のコンポーネントでも使用する可能性があるため）
      }
    }
  }, [apiKey])

  // Autocompleteの初期化
  useEffect(() => {
    if (!isGoogleLoaded || !autocompleteRef.current || !apiKey) return

    const autocomplete = new window.google.maps.places.Autocomplete(autocompleteRef.current, {
      types: ['establishment', 'geocode'],
      componentRestrictions: { country: 'jp' }, // 日本に限定
      fields: ['name', 'formatted_address', 'geometry', 'address_components'],
    })

    autocompleteInstanceRef.current = autocomplete

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (place.name) {
        onVenueNameChange(place.name)
      }
      if (place.formatted_address) {
        onVenueAddressChange(place.formatted_address)
      }
      setShowSuggestions(false)
    })

    // 入力時の検索候補表示（カスタム実装）
    const input = autocompleteRef.current
    const handleInput = () => {
      if (input.value.length > 2) {
        const service = new window.google.maps.places.PlacesService(document.createElement('div'))
        const request = {
          query: input.value,
          fields: ['name', 'formatted_address'],
        }

        service.textSearch(request, (results: any[], status: string) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            const suggestionsList = results.slice(0, 5).map((result) => ({
              name: result.name,
              address: result.formatted_address || '',
            }))
            setSuggestions(suggestionsList)
            setShowSuggestions(true)
          } else {
            setSuggestions([])
            setShowSuggestions(false)
          }
        })
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }

    input.addEventListener('input', handleInput)

    return () => {
      input.removeEventListener('input', handleInput)
      if (autocompleteInstanceRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteInstanceRef.current)
      }
    }
  }, [isGoogleLoaded, apiKey, onVenueNameChange, onVenueAddressChange])

  const handleSuggestionClick = (suggestion: { name: string; address: string }) => {
    onVenueNameChange(suggestion.name)
    onVenueAddressChange(suggestion.address)
    setShowSuggestions(false)
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ marginBottom: '15px' }}>
        <label>
          会場名（自動検索）
          <input
            ref={autocompleteRef}
            type="text"
            value={venueName}
            onChange={(e) => {
              onVenueNameChange(e.target.value)
            }}
            placeholder="会場名を入力してください（例: カードショップ アジト）"
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            disabled={!isGoogleLoaded && !!apiKey}
          />
          {!apiKey && (
            <small style={{ color: '#999', display: 'block', marginTop: '4px' }}>
              Google Maps API keyが設定されていません。手動で入力してください。
            </small>
          )}
        </label>
      </div>

      {/* 検索候補の表示 */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto',
            marginTop: '4px',
          }}
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              style={{
                padding: '10px',
                cursor: 'pointer',
                borderBottom: index < suggestions.length - 1 ? '1px solid #eee' : 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f5'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#fff'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{suggestion.name}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{suggestion.address}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
        <label>
          会場住所
          <input
            type="text"
            value={venueAddress}
            onChange={(e) => onVenueAddressChange(e.target.value)}
            placeholder="住所が自動入力されます（手動でも入力可能）"
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </label>
      </div>
    </div>
  )
}

