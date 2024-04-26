export const countItem = (selections: any, key: string, text: string) => {
    const res = groupSelections(selections, key);
    const noOf = Object.keys(res).length
    if (noOf > 1) {
        return Object.keys(res).length + ' ' + text;
    } else {
        return selections[0][key];
    }
}


export const groupSelections = (data: any, key: string) => {
    return data.reduce(function (r: any, a: any) {
        r[a[key]] = r[a[key]] || [];
        r[a[key]].push(a);
        return r;
    }, Object.create(null));
}

export const betTypeDescription = (bet) => {
    switch (bet.betType) {
        case 'Combo':
            return getSystemBetName(bet)
        case 'Multiple':
            return getComboName(bet.selections.length);
        default:
            return 'Singles';

    }
}

const getComboName = (selection) => 
{
    switch (selection) {
        case 2:
            return 'Com: Doubles';
        case 3:
            return 'Com: Trebles';
        default:
            return 'Com: ' + selection + ' folds';
    }
}

function getSystemBetName(bet)
{
    let desc = '';
    for (let index = 0; index < bet.Groupings.length; index++) {
        const combo = bet.Groupings[index];

        desc += 'Sys: ' + combo.Grouping + '/' + bet.selections + ' ' + combo.Combinations + ' x N'  + combo.Stake;
        if (index + 1 < bet.Groupings.length)
            desc += '; ';
    } 
    return desc;
}

export const paginateResponse = (data: any,page: number,limit: number, message = 'success') => {
    const [result, total]=data;
    const lastPage=Math.ceil(total/limit);
    const nextPage=page+1 >lastPage ? 0 :page+1;
    const prevPage=page-1 < 1 ? 0 :page-1;
    return {
      message,
      data: JSON.stringify([...result]),
      count: total,
      currentPage: page,
      nextPage: nextPage,
      prevPage: prevPage,
      lastPage: lastPage,
    }
  }