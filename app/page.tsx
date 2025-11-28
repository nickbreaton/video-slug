export async function download() {
  "use server";
  console.log("test");
}

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <button onClick={download}>Download</button>
    </div>
  );
}
