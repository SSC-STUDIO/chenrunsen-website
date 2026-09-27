window.__jayDebug = () => {
  const t = window.__jayTown
  const scene = t.scene
  const crows = scene.getObjectByName('wireCrows')
  const flock = scene.getObjectByName('skyFlock')
  const dump = (g, depth = 0) => {
    const lines = []
    const walk = (o) => {
      lines.push(`${'  '.repeat(depth)}${o.type} name=${o.name || '-'} children=${o.children.length}`)
      o.children.forEach(walk)
    }
    walk(g)
    return lines
  }
  let tickType = null
  if (crows) tickType = typeof crows.children[0]?.userData?.tick
  return {
    hasCrows: !!crows,
    crowsChildren: crows ? crows.children.length : 0,
    tree: crows ? dump(crows) : [],
    tickType,
    firstCrowPos: crows ? crows.children.map(c => [c.position.x.toFixed(2), c.position.y.toFixed(2), c.position.z.toFixed(2)]) : [],
    bodyRot: crows ? crows.children.map(c => c.children[0] ? [c.children[0].rotation.x, c.children[0].rotation.y, c.children[0].rotation.z].map(v=>+v.toFixed(6)) : null) : [],
    flockCount: flock ? flock.count : null,
    sceneChildren: scene.children.length,
  }
}
