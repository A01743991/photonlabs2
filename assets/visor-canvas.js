'use strict';

// Visor de compatibilidad. Usa las mismas mallas, texturas y dirección solar que WebGL.
function softwareRenderer() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', {alpha:false});
  const maps = new WeakMap();
  let shadowKey, shadowDepth;
  const shadowSize = 384, extent = 24;

  function pixels(map) {
    if (!map) return null;
    if (maps.get(map)?.version !== map.version) {
      const image = map.image;
      maps.set(map, {version:map.version, pixels:image.getContext('2d').getImageData(0, 0, image.width, image.height)});
    }
    return maps.get(map).pixels;
  }

  function sampleOffset(tex,map,u,v) {
    const tu=u*map.repeat.x,tv=v*map.repeat.y;
    return 4*(Math.min(tex.height-1,Math.floor((1-tv+Math.floor(tv))*tex.height))*tex.width+Math.floor((tu-Math.floor(tu))*tex.width));
  }

  function raster(a,b,c,width,height,visit) {
    const determinant = (b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if (Math.abs(determinant)<.003) return;
    const left=Math.max(0,Math.ceil(Math.min(a.x,b.x,c.x))), right=Math.min(width-1,Math.floor(Math.max(a.x,b.x,c.x)));
    const top=Math.max(0,Math.ceil(Math.min(a.y,b.y,c.y))), bottom=Math.min(height-1,Math.floor(Math.max(a.y,b.y,c.y)));
    const du=(b.y-c.y)/determinant, dv=(c.y-a.y)/determinant;
    for (let y=top;y<=bottom;y++) {
      let u=(left-c.x)*du+(c.x-b.x)*(y-c.y)/determinant;
      let v=(left-c.x)*dv+(a.x-c.x)*(y-c.y)/determinant;
      for (let x=left;x<=right;x++,u+=du,v+=dv) {
        const w=1-u-v;
        if (Math.min(u,v,w)>=-.00001) visit(y*width+x,u,v,w);
      }
    }
  }

  return {
    domElement:canvas, shadowMap:{}, setPixelRatio(){},
    setSize(w,h) {
      const scale=Math.min(1,1050/w,680/h);
      canvas.width=Math.max(1,Math.round(w*scale)); canvas.height=Math.max(1,Math.round(h*scale));
    },
    render(scene,camera) {
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      const width=canvas.width,height=canvas.height;
      context.fillStyle='#'+scene.background.getHexString();
      context.fillRect(0,0,width,height);
      const image=context.getImageData(0,0,width,height),depth=new Float32Array(width*height).fill(Infinity);
      const dir=sunLight.position.clone().normalize(), right=new THREE.Vector3(dir.z,0,-dir.x).normalize();
      const up=new THREE.Vector3().crossVectors(dir,right);
      const night=!sunLight.intensity, key=scene.userData.shadowRevision;
      const rebuild=shadowKey!==key || !shadowDepth;
      if(rebuild){shadowDepth=new Float32Array(shadowSize*shadowSize).fill(-Infinity);shadowKey=key;}
      const faces=[];
      scene.traverseVisible(mesh=>{
        if(!mesh.isMesh) return;
        const {position,uv}=mesh.geometry.attributes, index=mesh.geometry.index;
        const vertices=[];
        for(let i=0;i<position.count;i++) {
          const world=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
          const clip=world.clone().project(camera);
          vertices.push({world, x:(clip.x+1)*width/2, y:(1-clip.y)*height/2, z:clip.z,
            shadow:{x:(world.dot(right)/extent+.5)*shadowSize,y:(world.dot(up)/extent+.5)*shadowSize,z:world.dot(dir)},
            u:uv?.getX(i)||0,v:uv?.getY(i)||0});
        }
        for(let i=0;i<(index?.count??position.count);i+=3) {
          const a=vertices[index?index.getX(i):i], b=vertices[index?index.getX(i+1):i+1],c=vertices[index?index.getX(i+2):i+2];
          const sa=a.shadow,sb=b.shadow,sc=c.shadow;
          const cutout=mesh.material.alphaTest?pixels(mesh.material.map):null;
          if(rebuild&&!night&&mesh.castShadow) raster(sa,sb,sc,shadowSize,shadowSize,(j,u,v,w)=>{
            if(cutout && cutout.data[sampleOffset(cutout,mesh.material.map,a.u*u+b.u*v+c.u*w,a.v*u+b.v*v+c.v*w)+3]<115) return;
            const z=u*sa.z+v*sb.z+w*sc.z;
            if(z>shadowDepth[j]) shadowDepth[j]=z;
          });
          const normal=new THREE.Vector3().subVectors(b.world,a.world).cross(new THREE.Vector3().subVectors(c.world,a.world)).normalize();
          if((mesh.material.side!==THREE.DoubleSide && normal.dot(new THREE.Vector3().subVectors(camera.position,a.world))<=0) || Math.min(a.z,b.z,c.z)<-1 || Math.max(a.z,b.z,c.z)>1) continue;
          faces.push({a,b,c,mat:mesh.material, incidence:Math.max(0,normal.dot(dir))});
        }
      });
      for(const {a,b,c,mat,incidence} of faces) {
        const tex=pixels(mat.map), tint=mat.color.getHex(), emission=mat.emissive?.getHex()||0;
        const base=[tint>>16,(tint>>8)&255,tint&255],glow=[emission>>16,(emission>>8)&255,emission&255];
        raster(a,b,c,width,height,(j,u,v,w)=>{
          const z=a.z*u+b.z*v+c.z*w;
          if(z>=depth[j]) return;

          const sa=a.shadow,sb=b.shadow,sc=c.shadow;
          const sx=Math.round(sa.x*u+sb.x*v+sc.x*w),sy=Math.round(sa.y*u+sb.y*v+sc.y*w);
          const blocked=shadowDepth[sy*shadowSize+sx]>(sa.z*u+sb.z*v+sc.z*w+.11);
          const shade=night?.29:.62+(blocked?.03:.45)*incidence;
          const offset=tex?sampleOffset(tex,mat.map,a.u*u+b.u*v+c.u*w,a.v*u+b.v*v+c.v*w):0;
          if(mat.alphaTest && tex && tex.data[offset+3]<115) return;
          depth[j]=z;
          for(let k=0;k<3;k++) image.data[4*j+k]=base[k]*(tex?tex.data[offset+k]/255:1)*shade+glow[k]*mat.emissiveIntensity;
        });
      }
      context.putImageData(image,0,0);
    }
  };
}
