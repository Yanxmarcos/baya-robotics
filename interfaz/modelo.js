import * as THREE from 'three';

export function construirModelo(p) {
 const g=p.geometria, root=new THREE.Group();root.name='Modulo_optico_BAYA';
 const steel=new THREE.MeshStandardMaterial({color:0xaab8be,metalness:.66,roughness:.33});
 const dark=new THREE.MeshStandardMaterial({color:0x344850,metalness:.3,roughness:.55});
 const cyan=new THREE.MeshStandardMaterial({color:0x009bd0,metalness:.3,roughness:.35});
 const belt=new THREE.MeshStandardMaterial({color:0x234f58,roughness:.8});
 const rubber=new THREE.MeshStandardMaterial({color:0x121f27,roughness:.82});
 const white=new THREE.MeshStandardMaterial({color:0xd9e2e4,roughness:.6});
 const screen=new THREE.MeshStandardMaterial({color:0x002c3d,emissive:0x004454,emissiveIntensity:.5});
 const groups={},pickables=[],covers=[],rotors=[],labels=[];
 function assembly(name,funcion,evidencia,explosion){const a=new THREE.Group();a.name=name;a.userData={nombre:name,funcion,evidencia,explosion};root.add(a);groups[name]=a;return a;}
 function box(parent,name,x,y,z,l,h,w,mat){const o=new THREE.Mesh(new THREE.BoxGeometry(l,h,w),mat);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);pickables.push(o);return o;}
 function cyl(parent,name,x,y,z,r,length,mat,axis='z'){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,length,16),mat);if(axis==='z')o.rotation.x=Math.PI/2;else if(axis==='x')o.rotation.z=Math.PI/2;o.position.set(x,y,z);o.name=name;o.castShadow=true;parent.add(o);pickables.push(o);return o;}
 const L=g.largo_m,W=g.ancho_m,H=g.altura_banda_m;
 const frame=assembly('Bastidor','Sostiene transporte e inspección; apoyos regulables.','Forma general observada en folleto KATO 260 p. 1; cotas estimadas.',[0,0,0]);
 for(const z of [-W/2,W/2]){box(frame,'Larguero',L/2,H-.14,z,L,.14,.07,steel);box(frame,'Travesaño_inferior',L/2,.28,z,L,.05,.05,steel);}
 for(const x of [.15,1.4,2.5,3.7,5.05]){for(const z of [-W/2,W/2]){box(frame,'Pata',x,H/2-.08,z,.065,H-.16,.065,steel);cyl(frame,'Apoyo_regulable',x,.07,z,.018,.14,steel,'y');cyl(frame,'Pie_antivibracion',x,.015,z,.05,.03,rubber,'y');}box(frame,'Travesaño',x,H-.22,0,.06,.07,W,steel);}
 const transport=assembly('Banda de un carril','Recibe los frutos del riel y los transporta en fila al sensor y las salidas.','Disposición y movimiento simulados.',[0,.18,0]);
 box(transport,'Banda_inicial',.23,H-.024,0,.46,.035,W-.1,belt);
 const paso=.065;
 for(let x=.5;x<L-.12;x+=paso){const r=cyl(transport,'Rodillo_'+x.toFixed(2),x,H-.025,0,g.radio_rodillo_m,W-.12,x<2.3?steel:dark);rotors.push(r);}
 for(const z of [-W/2+.04,W/2-.04])box(transport,'Borde',L/2,H+.025,z,L,.06,.035,steel);
 const optics=assembly('Inspeccion optica','Recinto de iluminación y captura; el simulador genera mediciones sintéticas.','Recinto y cubierta cian observados en KATO 260 p. 1; cámaras internas conceptuales.',[0,.8,0]);
 const cx=(g.recinto_inicio_m+g.recinto_fin_m)/2, len=g.recinto_fin_m-g.recinto_inicio_m;
 for(const z of [-W/2,W/2]){box(optics,'Columna_optica',cx-len/2,H+.24,z,.07,.55,.06,steel);box(optics,'Columna_optica',cx+len/2,H+.24,z,.07,.55,.06,steel);const cover=box(optics,'Carcasa_lateral',cx,H+.4,z,len,.35,.045,steel);covers.push(cover);}
 covers.push(box(optics,'Techo_optico',cx,H+.64,0,len+.12,.06,W+.1,steel));
 for(const z of [-.29,.29]){const cap=box(optics,'Cubierta_cian',cx-.06,H+.76,z,len*.82,.24,.31,cyan);covers.push(cap);box(optics,'Ventilacion',cx-.08,H+.77,z+.157,.26,.065,.008,dark);}
 const internals=assembly('Interior conceptual','Representación pedagógica de iluminación y captura, sin cantidad industrial de cámaras.','Decisión académica; NO documenta hardware propietario.',[0,.42,0]);
 for(const z of [-.24,.24]){box(internals,'Iluminacion_conceptual',cx,H+.24,z,len*.75,.025,.025,new THREE.MeshStandardMaterial({color:0xc7efff,emissive:0x70cfff,emissiveIntensity:.8}));}
 box(internals,'Camara_simbolica',g.sensor_x_m,H+.37,0,.12,.1,.12,dark);cyl(internals,'Lente_simbolica',g.sensor_x_m,H+.3,0,.028,.05,screen,'y');
 const drives=assembly('Accionamientos','Comunica movimiento a transportadores; sin potencia industrial asignada.','Motores externos visibles; número y dimensiones representados por estimación.',[0,0,-.35]);
 for(const x of [.2,1.35,4.9]){box(drives,'Soporte_motor',x,H+.02,-W/2-.13,.18,.04,.23,steel);cyl(drives,'Motor',x,H+.16,-W/2-.19,.065,.22,dark,'y');cyl(drives,'Reductor',x,H+.02,-W/2-.15,.075,.15,steel,'z');}
 const output=assembly('Separación y cestas','Separa los frutos en tres clases y una cesta de recuperación. Las cestas se retiran en Despacho.','Mecanismo y clasificación simulados.',[0,0,.45]);
 const colors={rechazo:0xb54c41,estandar:0xb37a14,premium:0x067c73,revision:0x657381};
 const cestas={};
 const baya=new THREE.SphereGeometry(.062,10,7);
 const matBaya=new THREE.MeshStandardMaterial({color:0x29366b,roughness:.65});
 for(const [clase,x] of Object.entries(g.salidas_x_m)){
  const mat=new THREE.MeshStandardMaterial({color:colors[clase],roughness:.6});
  box(output,'Base_canaleta_'+clase,x,H-.16,.70,.43,.04,.83,steel);
  for(const dx of [-.23,.23])box(output,'Guarda_'+clase,x+dx,H-.10,.70,.022,.12,.83,steel);
  const cesta=new THREE.Group();
  cesta.name='Cesta_'+clase;
  cesta.userData={etiqueta:'Cesta de '+({premium:'premium',estandar:'estándar',rechazo:'rechazo',revision:'recuperación'})[clase],
   funcion:'Recibe los frutos enviados a este destino. Se retira en la estación de despacho.'};
  cesta.position.set(x,H-.50,1.05);
  output.add(cesta);
  box(cesta,'Base_'+clase,0,.045,0,.48,.09,.55,mat);
  for(const z of [-.253,.253])box(cesta,'Borde_'+clase,0,.134,z,.48,.20,.044,mat);
  for(const x of [-.218,.218])box(cesta,'Borde_'+clase,x,.134,0,.044,.20,.48,mat);
  const contenido=Array.from({length:24},(_,i)=>{
   const fruto=new THREE.Mesh(baya,matBaya);
   fruto.name='Contenido_simulado';
   fruto.position.set((i%3-1)*.125,.15+Math.floor(i/12)*.09,(Math.floor(i/3)%4-1.5)*.116);
   fruto.visible=false;
   cesta.add(fruto);
   return fruto;
  });
  cestas[clase]={cesta,contenido,origen:cesta.position.clone()};
  box(output,'Actuador_simbolico_'+clase,x,H+.03,-W/2+.05,.06,.06,.08,cyan);
  labels.push({text:clase==='revision'?'Recuperación':clase[0].toUpperCase()+clase.slice(1),position:new THREE.Vector3(x,H+.1,1.05)});
 }
 const hmi=assembly('Panel de operacion','Permite ajustar umbrales y observar resultados; no representa el software LUCAi.','Panel externo observado; interfaz didáctica propia.',[0,.1,.3]);
 box(hmi,'Brazo_panel',2.27,H+.26,W/2+.1,.07,.09,.25,steel);box(hmi,'Caja_panel',2.27,H+.37,W/2+.22,.36,.26,.07,steel);box(hmi,'Pantalla',2.27,H+.38,W/2+.258,.29,.18,.008,screen);
 for(let i=0;i<3;i++)box(hmi,'Indicador_pantalla',2.19+i*.075,H+.39,W/2+.264,.048,.075,.003,new THREE.MeshStandardMaterial({color:colors[Object.keys(colors)[i]],emissive:colors[Object.keys(colors)[i]],emissiveIntensity:.3}));
 const stopMat=new THREE.MeshStandardMaterial({color:0xbd322d});cyl(hmi,'Boton_parada_ilustrativo',2.48,H+.25,W/2+.19,.025,.025,stopMat);
 labels.unshift({text:'Inspección sintética',position:new THREE.Vector3(cx,H+1.0,0)},{text:'Alimentación',position:new THREE.Vector3(.4,H+.18,0)});
 const basePositions=new Map(Object.values(groups).map(a=>[a,a.position.clone()]));
 function vista(modo){for(const c of covers)c.visible=modo!=='interior';internals.visible=modo!=='exterior';for(const a of Object.values(groups)){a.position.copy(basePositions.get(a));if(modo==='explotada')a.position.add(new THREE.Vector3(...a.userData.explosion));}}
 vista('exterior');
 return {root,groups,pickables,rotors,labels,vista,internals,cestas};
}
