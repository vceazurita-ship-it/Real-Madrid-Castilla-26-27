"use client"

export default function OpenDashboardButton() {

  const openDashboard = () => {

    const width = 1400
    const height = 900

    const left = (window.screen.width - width) / 2
    const top = (window.screen.height - height) / 2

    window.open(
      "https://app.powerbi.com/groups/72b15128-4926-4b47-9f09-8cc8b02dfc26/reports/9e18f827-5b59-4f63-a11d-06dc2aac2ae7/ReportSection?experience=power-bi",
      "RMCF_Dashboard",
      `
      width=${width},
      height=${height},
      top=${top},
      left=${left},
      toolbar=no,
      menubar=no,
      location=no,
      status=no,
      scrollbars=yes,
      resizable=yes
      `
    )
  }

  return (
    <button
      onClick={openDashboard}
      className="group relative overflow-hidden rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B] px-8 py-4 text-base font-medium text-black transition-all duration-300 hover:scale-[1.02] hover:border-[#C8A96B] hover:shadow-[0_0_40px_rgba(200,169,107,0.35)]"
    >

      <span className="relative z-10">
        Open Performance Dashboard
      </span>

      <div className="absolute inset-0 bg-gradient-to-r from-[#C8A96B] to-[#E7D3A7] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

    </button>
  )
}