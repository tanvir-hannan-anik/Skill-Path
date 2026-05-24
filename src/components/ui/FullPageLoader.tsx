const DotLottie = 'dotlottie-wc' as unknown as React.ElementType;

export function FullPageLoader({ label: _label }: { label?: string }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-canvas">
      <DotLottie
        src="https://lottie.host/bcc8fc6e-85e7-44dc-b5cd-dcd4629ca36d/baWGTrRz4J.lottie"
        style={{ width: '300px', height: '300px' }}
        autoplay
        loop
      />
    </div>
  );
}
