"use client";

import { useDroppable } from "@dnd-kit/core";

export default function PitchPosition({

id,
children

}:any){

const {setNodeRef,isOver}=useDroppable({

id

});

return(

<div

ref={setNodeRef}

className={`
absolute
w-20
h-20
rounded-full
border-2
transition
flex
items-center
justify-center
${isOver
?"border-yellow-400 bg-yellow-400/20"
:"border-white/40"}
`}

>

{children}

</div>

)

}