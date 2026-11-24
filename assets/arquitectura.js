'use strict';

// Materiales repetibles del modelo. Las texturas se generan una vez y también funcionan sin conexión.
const arquitectura = (() => {
  const materials = new Map();
  function randomSequence(seed) {
    return () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  const textures = new Map();
  const sources = new Map();
  function photo(path) {
    if (!sources.has(path)) sources.set(path, new Promise((resolve,reject)=>{
      const image = new Image(); image.onload=()=>resolve(image); image.onerror=reject;
      image.src='assets/'+path;
    }));
    return sources.get(path);
  }
  function texture(kind) {
    if (textures.has(kind)) return textures.get(kind);
    const canvas = document.createElement('canvas');
    const size = canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const random = randomSequence(4927);
    ctx.fillStyle = '#ecebe8';
    ctx.fillRect(0, 0, size, size);
    if (kind === 'glass' || kind === 'cell') {
      const gradient = ctx.createLinearGradient(0, 0, 220, 240);
      const stops = kind === 'cell'
        ? ['#487089', '#18344d', '#172d45', '#284459']
        : ['#b7d8dc', '#7a9aa4', '#455e66', '#243e46'];
      stops.forEach((color, i) => gradient.addColorStop(i / 3, color));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      if (kind === 'cell') {
        for (let x = 0; x < size; x += 4) {
          ctx.fillStyle = x % 16 === 0 ? '#b8ccd46b' : '#a8bfce24';
          ctx.fillRect(x, 0, 1, size);
        }
        ctx.fillStyle = '#cad2d2';
        for (let i = 0; i <= 6; i++) ctx.fillRect(i * size / 6, 0, 1.9, size);
        for (let i = 0; i <= 12; i++) ctx.fillRect(0, i * size / 12, size, 1.2);
      } else {
        ctx.fillStyle = '#e3f3f21b';
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(120, 0); ctx.lineTo(235, size);
        ctx.lineTo(130, size); ctx.fill();
      }
    } else {
      const grain = ctx.getImageData(0, 0, size, size);
      const strength = kind === 'roof' ? 46 : 24;
      for (let i = 0; i < grain.data.length; i += 4) {
        const value = 249 - random() * strength;
        grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = value;
      }
      ctx.putImageData(grain, 0, 0);
      if (kind === 'timber') {
        for (let x = 0; x < size; x += 2) {
          ctx.fillStyle = 'rgba(60,25,8,' + random() * .28 + ')';
          ctx.fillRect(x, random() * 25, 1 + random() * 2, size);
        }
      }
      if (kind === 'masonry') {
        for (let y = 0; y < size; y += 32) {
          for (let x = (y % 64 ? -48 : 0); x < size; x += 96) {
            ctx.fillStyle = 'rgba(75,65,50,' + (.04 + random() * .16) + ')';
            ctx.fillRect(x + 2, y + 2, 93, 29);
          }
        }
      }
    }
    if (kind === 'foliage') {
      ctx.clearRect(0,0,size,size);
      const leafColors=['#84975b','#90a16d','#546c46','#465e3e','#abb484','#718949'];
      // Ramas transparentes superpuestas dejan pasar luz entre las hojas.
      function twig(x,y,angle,length,depth) {
        const ex=x+length*Math.cos(angle),ey=y+length*Math.sin(angle);
        ctx.strokeStyle=depth>1?'#74664a':'#71824f';
        ctx.lineWidth=depth+1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.stroke();
        if(depth) {
          for(let i=0;i<3;i++){
            const t=.36+i*.28;
            twig(x+(ex-x)*t,y+(ey-y)*t,angle+(i===1?-1:1)*(.33+random()*.65),length*.67,depth-1);
          }
        }
        if(depth<2) for(let i=0;i<15;i++){
          const t=random(),lx=x+(ex-x)*t+(random()-.5)*18,ly=y+(ey-y)*t+(random()-.5)*16;
          ctx.fillStyle=leafColors[Math.floor(random()*leafColors.length)];
          ctx.beginPath();ctx.ellipse(lx,ly,4+random()*3,1.8+random()*1.8,angle+random()*2,0,2*Math.PI);ctx.fill();
        }
      }
      for(let i=0;i<6;i++) twig(129,221,-2.65+i*.42,75+random()*17,3);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    if (kind === 'roof' || kind === 'plaster') map.repeat.set(4, 3);
    if (kind === 'gravel') map.repeat.set(7,6);
    const files={plaster:'concreto.webp',roof:'concreto.webp',gravel:'grava.webp',glass:'techos-solares.webp'};
    if(files[kind]) photo(files[kind]).then(image=>{
      if(kind==='glass'){
        ctx.drawImage(image,120,490,1450,700,0,0,size,size);
        ctx.fillStyle='rgba(42,73,82,.64)';ctx.fillRect(0,0,size,size);
      } else {
        ctx.drawImage(image,0,0,size,size);
        if(kind==='plaster'){ctx.fillStyle='rgba(239,237,227,.36)';ctx.fillRect(0,0,size,size);}
      }
      map.needsUpdate=true;
      window.dispatchEvent(new Event('studio-material'));
    }).catch(()=>{ /* La textura generada permanece disponible. */ });
    textures.set(kind,map);
    return map;
  }

  function material(color, kind = '') {
    const key = color + kind;
    if (!materials.has(key)) {
      materials.set(key, new THREE.MeshStandardMaterial({
        color, map: kind ? texture(kind) : null,
        metalness: kind === 'cell' ? .22 : .04,
        roughness: ['glass', 'cell'].includes(kind) ? .35 : .85,
        side: kind==='foliage'?THREE.DoubleSide:THREE.FrontSide, alphaTest:kind==='foliage'?.45:0
      }));
    }
    return materials.get(key);
  }

  const cube = new THREE.BoxGeometry(1, 1, 1);
  function block(parent, x, y, z, width, height, depth, color, kind) {
    const mesh = new THREE.Mesh(cube, material(color, kind));
    mesh.scale.set(width, height, depth);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const limestone = 0xe2ddca, cement = 0xbcb8ac, dark = 0x303a3a, timber = 0xb28459;
  function glazing(parent, x, y, z, width, height, angle, panes, windows) {
    const frame = new THREE.Group();
    frame.position.set(x, y, z);
    frame.rotation.y = angle;
    parent.add(frame);
    block(frame, 0, 0, 0, width + .14, height + .14, .12, dark);
    const glass = block(frame, 0, 0, .075, width, height, .04, 0xffffff, 'glass');
    windows.push(glass);
    for (let i = 1; i < panes; i++) {
      block(frame, width * (i / panes - .5), 0, .11, .045, height, .045, dark);
    }
    block(frame, 0, -height / 2 - .12, .02, width + .26, .11, .27, cement);
  }

  function house(scene, floors, windows) {
    const group = new THREE.Group();
    scene.add(group);
    const top = floors * 2.8;
    block(group, 0, top / 2, 0, 8, top, 6, limestone, 'plaster');
    for (let f = 0; f < floors; f++) {
      const y = 2.8 * f;
      glazing(group, -1.85, y + 1.4, 3.04, 3.4, 1.95, 0, 3, windows);
      glazing(group, 4.04, y + 1.5, -.7, 2.75, 1.6, Math.PI / 2, 3, windows);
      glazing(group, -4.04, y + 1.5, 0, 2.5, 1.6, -Math.PI / 2, 2, windows);
      glazing(group, 1.2, y + 1.5, -3.04, 3.6, 1.35, Math.PI, 3, windows);
      if (f) {
        block(group, 0, y, 0, 8.18, .17, 6.14, cement);
        glazing(group, 2.5, y + 1.4, 3.04, 1.8, 1.85, 0, 2, windows);
      }
    }
    block(group, .92, 1.38, 3.06, 1.44, 2.76, .14, timber, 'timber');
    block(group, 2.33, 1.19, 3.09, 1.24, 2.38, .18, dark);
    block(group, 2.33, 1.16, 3.2, 1.12, 2.29, .08, timber, 'timber');
    block(group, 2.71, 1.1, 3.27, .035, .6, .06, dark);
    for (let i = 0; i < 10; i++) block(group, .3 + i * .14, 1.39, 3.18, .064, 2.78, .12, timber);
    block(group, -3.87, top / 2, 3.13, .42, top, .38, 0xc9bda4, 'masonry');
    block(group, 0, top + .09, 0, 8.32, .18, 6.32, cement, 'roof');
    for (const side of [-1, 1]) {
      block(group, side * 4.09, top + .30, 0, .16, .28, 6.32, limestone);
      block(group, 0, top + .30, side * 3.09, 8.08, .28, .16, limestone);
    }
    // La pérgola queda fuera del rectángulo útil de la azotea.
    block(group, -1.57, 2.65, 4.8, 4.85, .19, .16, dark);
    for (const x of [-3.91, .75]) block(group, x, 1.33, 4.8, .13, 2.66, .13, dark);
    for (let i = 0; i < 17; i++) block(group, -3.91 + i * .29, 2.8, 3.95, .11, .18, 2.12, timber);
    block(group, -1.55, .08, 4.05, 4.95, .16, 2.12, 0xbeab91, 'roof');
    block(group, 2.28, .09, 3.48, 2.45, .18, .96, cement);
    // Volumen lateral de servicio, bajante de lluvia y balcón hacia el jardín.
    block(group,-5.08,1.07,-1.16,2.18,2.14,3.6,0xc2bba5,'plaster');
    block(group,-5.08,2.2,-1.16,2.35,.13,3.78,cement,'roof');
    glazing(group,-5.08,1.18,.66,1.3,.95,0,2,windows);
    block(group,4.09,top/2,-2.57,.09,top,.12,0x7b8079);
    if(floors===2){
      block(group,4.53,2.81,-.7,1.06,.19,3.62,cement,'roof');
      for(const z of [-2.44,-.7,1.04]) block(group,5.02,3.35,z,.055,1.03,.055,dark);
      for(const y of [3.14,3.48,3.84]){
        block(group,5.02,y,-.7,.04,.04,3.56,dark);
        for(const z of [-2.46,1.06]) block(group,4.52,y,z,1.02,.04,.04,dark);
      }
    }
    return group;
  }

  const leaf = new THREE.PlaneGeometry(1,1);
  const limb = new THREE.CylinderGeometry(.065,.105,1,7);
  function plant(parent, x, z, scale, seed) {
    const random = randomSequence(seed);
    const colors=[0xffffff,0xe6e9ca,0xbacaaa,0xdbe0b8];
    block(parent,x,.68*scale,z,.11*scale,1.36*scale,.12*scale,0x73624f);
    for(let i=0;i<5;i++){
      const angle=i*2.4;
      const branch=new THREE.Mesh(limb,material(0x796a53));
      branch.position.set(x+.22*scale*Math.cos(angle),1.27*scale,z+.22*scale*Math.sin(angle));
      branch.scale.setScalar(scale); branch.rotation.z=-.58*Math.cos(angle);branch.rotation.x=.58*Math.sin(angle);
      branch.castShadow=true;parent.add(branch);
    }
    // Agrupar las tarjetas de hojas en cuatro mallas por planta mantiene fluida la órbita.
    const batches=colors.map(()=>({positions:[], normals:[], uvs:[]}));
    const point=new THREE.Vector3(), normal=new THREE.Vector3(), transform=new THREE.Object3D();
    for(let i=0;i<50;i++){
      const angle=random()*Math.PI*2, radius=Math.sqrt(random())*1.05;
      transform.position.set(x+Math.cos(angle)*radius*scale,(1.44+(1-radius)*.97+random()*.58)*scale,z+Math.sin(angle)*radius*scale);
      transform.scale.setScalar((1.04+random()*.53)*scale);
      transform.rotation.set((random()-.5)*1.45,angle,(random()-.5)*1.25);
      transform.updateMatrix();
      normal.set(0,0,1).applyQuaternion(transform.quaternion);
      const batch=batches[i%colors.length];
      for(const index of leaf.index.array){
        point.fromBufferAttribute(leaf.attributes.position,index).applyMatrix4(transform.matrix);
        batch.positions.push(point.x,point.y,point.z);
        batch.normals.push(normal.x,normal.y,normal.z);
        batch.uvs.push(leaf.attributes.uv.getX(index),leaf.attributes.uv.getY(index));
      }
    }
    batches.forEach((batch,i)=>{
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uvs,2));
      const crown=new THREE.Mesh(geometry,material(colors[i],'foliage'));
      crown.castShadow=crown.receiveShadow=true;parent.add(crown);
    });
  }

  function landscape(scene) {
    block(scene, 0, -.38, .55, 15, .65, 14.4, 0x807f73, 'masonry');
    block(scene, 0, -.042, -.35, 14.95, .065, 12.54, 0xe0d6bd, 'gravel');
    block(scene, 0, -.042, 6.83, 15, .066, 1.84, 0x555c61, 'roof');
    block(scene, 0, .023, 5.64, 15, .12, .64, cement);
    for (let j = 0; j < 4; j++) block(scene, 2.32, .04, 3.96 + j * .43, 1.85, .085, .35, 0xd3cbbb);
    for (let j = 0; j < 6; j++) block(scene, -5.25, .032, -3.55 + j * 1.45, 1.83, .07, 1.4, 0xc1bcae, 'roof');
    block(scene, 0, .45, -5.99, 14.7, .9, .18, 0xbfb9a6, 'plaster');
    block(scene, -7.24, .45, -.5, .18, .9, 11, 0xbfb9a6, 'plaster');
    for (const [x,z,s,seed] of [[5.8,-3.9,1.5,23],[-5.8,-4.8,1.12,54],[5.7,2.9,.7,81],[-5,4,.55,93]]) {
      plant(scene,x,z,s,seed);
    }
    for (const side of [-1,1]) {
      block(scene, side * 3.6,.19,5.12,1.65,.38,.67,0xb8ae98,'masonry');
      block(scene, side * 3.6,.39,5.12,1.53,.035,.55,0x4a4637);
      for(let i=0;i<4;i++) plant(scene,side*3.6-.55+i*.36,5.12,.32,123+i);
    }
  }

  function panel(parent) {
    const mount = new THREE.Group(), face = new THREE.Group();
    parent.add(mount); mount.add(face);
    for (const side of [-1,1]) {
      block(mount, side*.33, -.33, 0, .055, .66, .07, 0x8b9390);
      block(mount, side*.33, -.64, 0, .29, .08, .39, 0xaaa89d);
    }
    block(face, 0, 0, 0, 1.04, .056, 1.32, 0xb7c3c9);
    block(face, 0, .033, 0, 1.002, .012, 1.28, 0xffffff, 'cell');
    block(face, 0, -.033, 0, .996, .012, 1.27, 0xd8d6c9);
    return {mount, face};
  }
  return {house, landscape, panel};
})();
