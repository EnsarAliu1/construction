/** Exact decimal formatting; money never passes through Number or parseFloat. */
export function displayEuro(value:string){
 if(!/^-?\d+\.\d{2}$/.test(value))throw new Error('Shumë e pavlefshme.');
 const [whole,fraction]=value.split('.');return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')}${fraction==='00'?'':','+fraction} €`;
}
