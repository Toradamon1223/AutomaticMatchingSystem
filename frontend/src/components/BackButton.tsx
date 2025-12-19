import { useNavigate } from 'react-router-dom'

interface BackButtonProps {
  to?: string
  label?: string
}

export default function BackButton({ to, label = '戻る' }: BackButtonProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (to) {
      navigate(to)
    } else {
      navigate(-1)
    }
  }

  return (
    <button
      onClick={handleClick}
      style={{
        padding: '8px 15px',
        backgroundColor: '#666',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        marginBottom: '20px',
      }}
    >
      ← {label}
    </button>
  )
}

