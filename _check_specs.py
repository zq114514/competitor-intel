# -*- coding: utf-8 -*-
import re, sys

PATH = r'c:\Users\chunsheng\Desktop\S59\AI场景\AI1\webapp\js\data.js'
s = open(PATH, encoding='utf-8').read()

IDS = ['fangchengs','tank300hk','idaura-t6','jia-yue07','hongqi-tg07','ec6-aura','bick-e7','g9l']
ALLOWED = set('''最大功率 kW|最大扭矩 Nm|前电机功率 Kw|前电机扭矩 Nm|后电机功率 Kw|后电机扭矩 Nm|发动机|变速箱|四驱形式|电池能量 kWh|电池类型|纯电续航 km|综合续航 km|百公里电耗 kWh/100KM|风阻系数 Cd|车身结构|车身形式|长 mm|宽 mm|高 mm|轴距 mm|前轮距 mm|后轮距 mm|接近角 °|离去角 °|后备箱容积|最小转弯直径 m|整备质量 kg|最大满载质量 kg|备胎|零百加速 s|最高车速 km/h|前悬架类型|后悬架类型|可变悬架功能|轮胎|智驾芯片|激光雷达|高速领航|城市领航|气囊数|安全认证'''.split('|'))
ALLOWED.add('fastCharge')
OLD_KEYS = {'size','power','accel','topSpeed','weight','suspension','safety'}

# ---------- strip strings/comments, keep code chars ----------
def code_chars(s):
    out=[]; stack=['code']; i=0; n=len(s)
    while i<n:
        m=stack[-1]
        if m in ('code','interp'):
            if s[i:i+2]=='//':
                j=s.find('\n',i); 
                i = n if j==-1 else j
            elif s[i:i+2]=='/*':
                j=s.find('*/',i+2); 
                i = n if j==-1 else j+2
            elif s[i]=="'":
                i+=1
                while i<n and s[i]!="'":
                    i+= 2 if s[i]=='\\' else 1
                i+=1
            elif s[i]=='"':
                i+=1
                while i<n and s[i]!='"':
                    i+= 2 if s[i]=='\\' else 1
                i+=1
            elif s[i]=='`':
                stack.append('tpl'); i+=1
            elif m=='interp':
                if isinstance(m,str):
                    stack[-1]=('interp',0); m=stack[-1]
                if s[i]=='{':
                    stack[-1]=('interp',m[1]+1); out.append('{'); i+=1
                elif s[i]=='}':
                    if m[1]==0:
                        stack.pop(); i+=1
                    else:
                        stack[-1]=('interp',m[1]-1); out.append('}'); i+=1
                else:
                    out.append(s[i]); i+=1
            else:
                out.append(s[i]); i+=1
        elif m=='tpl':
            if s[i]=='\\': i+=2
            elif s[i]=='`': stack.pop(); i+=1
            elif s[i:i+2]=='${':
                stack.append(('interp',0)); i+=2
            else: i+=1
    return ''.join(out)

code = code_chars(s)
bal = {p: code.count(a)-code.count(b) for p,a,b in [('{}','{','}'),('[]','[',']'),('()','(',')')]}
rawbal = {p: s.count(a)-s.count(b) for p,a,b in [('{}','{','}'),('[]','[',']'),('()','(',')')]}

print('SPEC_GROUPS 定义存在:', 'const SPEC_GROUPS' in s)
print('剥离字符串/注释后括号差值:', bal, '(全部为0即平衡)')
print('原始文本括号差值(参考):', rawbal)

# ---------- extract specs block for each id ----------
def match_brace(s, open_idx):
    depth=0; i=open_idx; n=len(s)
    while i<n:
        c=s[i]
        if c=="'":
            i+=1
            while i<n and s[i]!="'":
                i+= 2 if s[i]=='\\' else 1
        elif c=='"':
            i+=1
            while i<n and s[i]!='"':
                i+= 2 if s[i]=='\\' else 1
        elif c=='{': depth+=1
        elif c=='}':
            depth-=1
            if depth==0: return i
        i+=1
    return -1

def parse_entries(block):
    entries=[]; depth=0; i=0; n=len(block); start=0
    while i<n:
        c=block[i]
        if c in "'\"":
            q=c; i+=1
            while i<n and block[i]!=q:
                i+= 2 if block[i]=='\\' else 1
        elif c in '{[(': depth+=1
        elif c in '}])': depth-=1
        elif c==',' and depth==0:
            entries.append(block[start:i]); start=i+1
        i+=1
    if start<n: entries.append(block[start:])
    res=[]
    for e in entries:
        e=e.strip()
        if not e: continue
        k,_,v=e.partition(':')
        k=k.strip(); v=v.strip()
        if (k.startswith("'") and k.endswith("'")) or (k.startswith('"') and k.endswith('"')):
            k=k[1:-1]
        if (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
            v=v[1:-1]
        res.append((k,v))
    return res

all_ok=True
for cid in IDS:
    m=re.search(r"id:\s*'"+re.escape(cid)+r"'", s)
    sp=s.find('specs:', m.end())
    ob=s.find('{', sp)
    cb=match_brace(s, ob)
    block=s[ob+1:cb]
    pairs=parse_entries(block)
    keys=[k for k,_ in pairs]
    bad=[k for k in keys if k not in ALLOWED]
    leftover=[k for k in keys if k in OLD_KEYS]
    ok = not bad and not leftover and 'fastCharge' in keys
    all_ok &= ok
    print('\n==== %s ==== 键数:%d 校验:%s' % (cid, len(keys), 'OK' if ok else 'FAIL'))
    if bad: print('  !! 非法键:', bad)
    if leftover: print('  !! 残留旧键:', leftover)
    for k,v in pairs:
        print('  %s = %s' % (k, v))

print('\n总体结果:', 'ALL PASS' if all_ok and all(d==0 for d in bal.values()) else 'HAS PROBLEM')
