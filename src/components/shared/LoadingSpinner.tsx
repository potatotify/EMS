export default function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#F2FBF5] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
