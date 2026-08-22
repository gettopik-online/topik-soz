/* GETTOPIK online — TOPIK yozish backend.
   Talaba yakuniy PDF'ni /submit orqali yuboradi, ustoz /list va /pdf orqali
   parol bilan ko'rib/yuklab oladi. KV'da faqat base64 PDF va ism/vaqt saqlanadi. */

function cors(){
  return {
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type'
  };
}
function json(obj, status=200){
  return new Response(JSON.stringify(obj), {status, headers:{...cors(), 'Content-Type':'application/json'}});
}

export default {
  async fetch(req, env){
    const url = new URL(req.url);

    if(req.method==='OPTIONS') return new Response(null, {headers:cors()});

    if(url.pathname==='/submit' && req.method==='POST'){
      let body;
      try{ body = await req.json(); }catch(e){ return json({ok:false,error:'bad json'},400); }
      const name = String(body.name||"noma'lum").slice(0,60);
      const pdfBase64 = body.pdfBase64;
      if(!pdfBase64 || typeof pdfBase64!=='string') return json({ok:false,error:'no pdf'},400);
      const id = Date.now()+'-'+Math.random().toString(36).slice(2,8);
      await env.SUBMISSIONS.put('sub:'+id, pdfBase64, {metadata:{name, at:Date.now()}});
      return json({ok:true, id});
    }

    if(url.pathname==='/list' && req.method==='GET'){
      const pass = url.searchParams.get('pass');
      if(!env.TEACHER_PASS || pass !== env.TEACHER_PASS) return json({ok:false,error:'unauthorized'},401);
      const list = await env.SUBMISSIONS.list({prefix:'sub:'});
      const rows = list.keys.map(k=>({
        id:k.name.slice(4),
        name:k.metadata&&k.metadata.name,
        at:k.metadata&&k.metadata.at
      })).sort((a,b)=>(b.at||0)-(a.at||0));
      return json({ok:true, rows});
    }

    if(url.pathname==='/pdf' && req.method==='GET'){
      const pass = url.searchParams.get('pass');
      if(!env.TEACHER_PASS || pass !== env.TEACHER_PASS) return new Response('unauthorized',{status:401,headers:cors()});
      const id = url.searchParams.get('id');
      if(!id) return new Response('missing id',{status:400,headers:cors()});
      const b64 = await env.SUBMISSIONS.get('sub:'+id);
      if(!b64) return new Response('not found',{status:404,headers:cors()});
      const bin = Uint8Array.from(atob(b64), c=>c.charCodeAt(0));
      return new Response(bin, {headers:{...cors(), 'Content-Type':'application/pdf', 'Content-Disposition':`attachment; filename="${id}.pdf"`}});
    }

    return new Response('not found', {status:404, headers:cors()});
  }
};
