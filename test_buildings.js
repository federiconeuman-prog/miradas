async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/buildings');
    const data = await res.json();
    for (const b of data) {
      if (b.id === 'abasto' || b.id === 'xul-solar' || b.id === 'ateneo') {
        console.log("BUILDING:", b);
      }
    }
  } catch (err) {
    console.error("Error", err.message);
  }
}
run();
