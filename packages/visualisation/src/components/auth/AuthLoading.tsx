export function AuthLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4" />
        <p className="text-lg text-gray-700 font-medium">Loggar in...</p>
      </div>
    </div>
  )
}
